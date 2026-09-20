import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
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

  private async sendVerificationEmail(email: string, name: string, rawToken: string): Promise<void> {
    const appUrl = this.config.getOrThrow<string>('PUBLIC_APP_URL');
    const link = `${appUrl}/verify-email?token=${rawToken}`;
    await this.email.send(
      email,
      'Verify your CampaignHub AI account',
      `Hi ${name},\n\nPlease verify your email address to activate your CampaignHub AI account:\n\n${link}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`,
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
