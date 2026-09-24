import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { EmailService } from '../notifications/email.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Role } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.js';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_VERIFICATION_GENERIC_RESULT = {
  message: 'If an account with that email exists and is not yet verified, a new verification link has been sent.',
};
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
// Same email-enumeration reasoning as RESEND_VERIFICATION_GENERIC_RESULT — whether this address
// has an account at all is exactly the kind of thing a "forgot password" form must never reveal.
const FORGOT_PASSWORD_GENERIC_RESULT = {
  message: 'If an account with that email exists, a password reset link has been sent.',
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private email: EmailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateVerificationToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = randomBytes(32).toString('hex');
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    };
  }

  // Shorter-lived than email verification (1 hour vs 24) — a password-reset link sitting in an
  // inbox is a more sensitive thing to leave valid for a full day than a signup-confirmation link.
  private generatePasswordResetToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = randomBytes(32).toString('hex');
    return {
      rawToken,
      tokenHash: this.hashToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    };
  }

  private async sendVerificationEmail(email: string, name: string, rawToken: string): Promise<void> {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    const link = `${appUrl}/verify-email?token=${rawToken}`;
    await this.email.send(
      email,
      'Verify your CampaignHub AI account',
      `Hi ${name},\n\nPlease verify your email address to activate your CampaignHub AI account:\n\n${link}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`,
    );
  }

  private async sendPasswordResetEmail(email: string, name: string, rawToken: string): Promise<void> {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    const link = `${appUrl}/reset-password?token=${rawToken}`;
    await this.email.send(
      email,
      'Reset your CampaignHub AI password',
      `Hi ${name},\n\nSomeone requested a password reset for your CampaignHub AI account. If this was you, choose a new password here:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.`,
    );
  }

  private async issueTokenPair(user: {
    id: string;
    email: string;
    role: Role;
    agencyId: string | null;
  }): Promise<TokenPair> {
    const payload: AuthenticatedUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
    };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    } as JwtSignOptions);

    const jti = randomUUID();
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const refreshToken = this.jwt.sign(
      { sub: user.id, jti },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      } as JwtSignOptions,
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    const refreshTokenExpiresAt = new Date(decoded.exp * 1000);

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return { accessToken, refreshToken, refreshTokenExpiresAt };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const { rawToken, tokenHash, expiresAt } = this.generateVerificationToken();

    const { user, agency } = await this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({ data: { name: dto.agencyName } });
      const user = await tx.user.create({
        data: {
          agencyId: agency.id,
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: Role.OWNER,
          verificationTokenHash: tokenHash,
          verificationTokenExpiresAt: expiresAt,
        },
      });
      return { user, agency };
    });

    await this.audit.log({
      userId: user.id,
      action: 'AGENCY_REGISTERED',
      entityType: 'agency',
      entityId: agency.id,
    });

    await this.sendVerificationEmail(user.email, user.name, rawToken);

    return { message: 'Check your email to verify your account.' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_FAILED_INACTIVE',
        entityType: 'user',
        entityId: user.id,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerifiedAt) {
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_FAILED_UNVERIFIED',
        entityType: 'user',
        entityId: user.id,
      });
      throw new UnauthorizedException('Please verify your email before logging in.');
    }

    await this.audit.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'user',
      entityId: user.id,
    });

    const tokens = await this.issueTokenPair(user);
    return { user: this.toSafeUser(user), ...tokens };
  }

  // Verifies the ID token's signature/audience/expiry against Google's own published keys — no
  // client secret involved, since that's only needed for the server-side redirect flow this app
  // doesn't use. Fails closed (never constructs a verifier with no audience to check against) if
  // GOOGLE_CLIENT_ID isn't configured, matching EmailService's optional-feature pattern.
  private async verifyGoogleIdToken(
    idToken: string,
  ): Promise<{ email: string; name: string; googleId: string; emailVerified: boolean }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is not configured');
    }

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in token');
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Invalid Google sign-in token');
    }

    return {
      email: payload.email,
      name: payload.name ?? payload.email,
      googleId: payload.sub,
      emailVerified: payload.email_verified ?? false,
    };
  }

  async googleAuth(idToken: string) {
    const { email, name, googleId, emailVerified } = await this.verifyGoogleIdToken(idToken);
    if (!emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const byGoogleId = await this.prisma.user.findUnique({ where: { googleId } });
    if (byGoogleId) {
      return this.completeGoogleSignIn(byGoogleId);
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      // Safe to link without any further proof — emailVerified above already confirms Google
      // itself vouches for this exact address, the same bar `verifyEmail()` clears via a clicked
      // link. The account's original password (if any) keeps working after this.
      const linked = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId },
      });
      await this.audit.log({
        userId: linked.id,
        action: 'GOOGLE_ACCOUNT_LINKED',
        entityType: 'user',
        entityId: linked.id,
      });
      return this.completeGoogleSignIn(linked);
    }

    // No match at all — first time this person has ever touched CampaignHub AI. Mirrors
    // register()'s transaction shape exactly, except emailVerifiedAt is set immediately (Google
    // already proved it) and a random, never-usable passwordHash fills the required column
    // without needing a schema migration to make it nullable.
    const randomPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
    const { user, agency } = await this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({ data: { name: `${name}'s Agency` } });
      const user = await tx.user.create({
        data: {
          agencyId: agency.id,
          email,
          passwordHash: randomPasswordHash,
          name,
          role: Role.OWNER,
          googleId,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      });
      return { user, agency };
    });

    await this.audit.log({
      userId: user.id,
      action: 'AGENCY_REGISTERED',
      entityType: 'agency',
      entityId: agency.id,
      metadata: { via: 'google' },
    });

    return this.completeGoogleSignIn(user);
  }

  private async completeGoogleSignIn(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    agencyId: string | null;
    isActive: boolean;
  }) {
    if (!user.isActive) {
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_FAILED_INACTIVE',
        entityType: 'user',
        entityId: user.id,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.audit.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'user',
      entityId: user.id,
      metadata: { via: 'google' },
    });

    const tokens = await this.issueTokenPair(user);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.prisma.user.findUnique({ where: { verificationTokenHash: tokenHash } });

    if (!user || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) {
      throw new UnauthorizedException('This verification link is invalid or has expired.');
    }

    const verifiedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
      },
    });

    await this.audit.log({
      userId: verifiedUser.id,
      action: 'EMAIL_VERIFIED',
      entityType: 'user',
      entityId: verifiedUser.id,
    });

    const tokens = await this.issueTokenPair(verifiedUser);
    return { user: this.toSafeUser(verifiedUser), ...tokens };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt) {
      return RESEND_VERIFICATION_GENERIC_RESULT;
    }

    const { rawToken, tokenHash, expiresAt } = this.generateVerificationToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationTokenHash: tokenHash, verificationTokenExpiresAt: expiresAt },
    });

    await this.sendVerificationEmail(user.email, user.name, rawToken);

    return RESEND_VERIFICATION_GENERIC_RESULT;
  }

  // The one account-recovery path that didn't exist at all before this — an Owner/Admin could
  // reset a *team member's* password (UsersService.resetMemberPassword), but nothing let someone
  // recover their own forgotten password, so a solo Owner locked out of their only account had no
  // way back in short of someone editing the database by hand.
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same generic response whether or not the account exists, and even if the account is
    // deactivated — confirming/denying either fact to an anonymous caller is exactly what this
    // endpoint must never do.
    if (!user || !user.isActive) {
      return FORGOT_PASSWORD_GENERIC_RESULT;
    }

    const { rawToken, tokenHash, expiresAt } = this.generatePasswordResetToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetTokenHash: tokenHash, passwordResetTokenExpiresAt: expiresAt },
    });

    await this.sendPasswordResetEmail(user.email, user.name, rawToken);

    return FORGOT_PASSWORD_GENERIC_RESULT;
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.prisma.user.findUnique({ where: { passwordResetTokenHash: tokenHash } });

    if (!user || !user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
      throw new UnauthorizedException('This password reset link is invalid or has expired.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    // A password reset is a real security event — anyone holding a session from before the reset
    // (e.g. a stolen refresh token that's exactly why a reset was needed) shouldn't get to keep
    // using it. changePassword() (users.service.ts) doesn't do this today; this path is the
    // higher-risk one, since it doesn't require already knowing the current password.
    await this.prisma.refreshToken.updateMany({
      where: { userId: updated.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      userId: updated.id,
      action: 'PASSWORD_RESET',
      entityType: 'user',
      entityId: updated.id,
    });

    const tokens = await this.issueTokenPair(updated);
    return { user: this.toSafeUser(updated), ...tokens };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.tokenHash !== this.hashToken(refreshToken)
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active');
    }

    // rotate: revoke the used refresh token, issue a fresh pair
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(user);
    return { user: this.toSafeUser(user), ...tokens };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    try {
      const payload = this.jwt.decode(refreshToken) as { jti?: string } | null;
      if (payload?.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // best-effort; an already-invalid token needs no revocation
    }
  }

  // Every login/refresh leaves a permanent row (see issueTokenPair/refresh above) — revoked or
  // expired ones serve no purpose once past their own expiresAt, so this table grows forever
  // without a cleanup pass. Called by AuthCronService, same shape as ClientsService.purgeExpired.
  async purgeExpiredRefreshTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
      },
    });
    return result.count;
  }

  private toSafeUser(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    agencyId: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      agencyId: user.agencyId,
    };
  }
}
