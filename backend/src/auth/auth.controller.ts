import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService, TokenPair } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Public } from '../common/decorators/public.decorator.js';

const REFRESH_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  // Must match wherever this controller actually ends up mounted — local dev has no API_PREFIX
  // so this is plain /auth; the combined production server sets API_PREFIX=api, making the real
  // route /api/auth/refresh, and the cookie's path has to match or the browser won't send it.
  private get refreshCookiePath(): string {
    const prefix = this.config.get<string>('API_PREFIX', '');
    return `${prefix ? `/${prefix}` : ''}/auth`;
  }

  private setRefreshCookie(res: Response, tokens: TokenPair) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: this.refreshCookiePath,
      expires: tokens.refreshTokenExpiresAt,
    });
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, refreshTokenExpiresAt, ...rest } =
      await this.authService.register(dto);
    this.setRefreshCookie(res, { accessToken, refreshToken, refreshTokenExpiresAt });
    return { ...rest, accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, refreshTokenExpiresAt, ...rest } =
      await this.authService.login(dto);
    this.setRefreshCookie(res, { accessToken, refreshToken, refreshTokenExpiresAt });
    return { ...rest, accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException('No refresh token supplied');
    }
    const { accessToken, refreshToken, refreshTokenExpiresAt, ...rest } =
      await this.authService.refresh(token);
    this.setRefreshCookie(res, { accessToken, refreshToken, refreshTokenExpiresAt });
    return { ...rest, accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: this.refreshCookiePath });
  }
}
