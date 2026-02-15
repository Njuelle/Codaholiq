import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Inject,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { ExchangeCodeSchema } from './dto/auth.dto';
import type { ExchangeCodeDto } from './dto/auth.dto';

const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_MAX_AGE = 600_000; // 10 minutes
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
@Public()
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
  }

  @Get('github')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  githubLogin(@Res() res: Response): void {
    const clientId = this.configService.getOrThrow<string>('GITHUB_CLIENT_ID');
    const redirectUri = `${this.configService.get<string>('API_URL', 'http://localhost:3000')}/auth/github/callback`;
    const scope = 'read:user read:org user:email';
    const state = randomBytes(32).toString('hex');

    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: OAUTH_STATE_MAX_AGE,
      path: '/auth/github/callback',
    });

    const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
    res.redirect(url);
  }

  @Get('github/callback')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const storedState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
    if (!state || !storedState || !this.verifyState(state, storedState)) {
      throw new UnauthorizedException('Invalid OAuth state parameter');
    }

    res.clearCookie(OAUTH_STATE_COOKIE, { path: '/auth/github/callback' });

    if (!code) {
      throw new BadRequestException('Missing authorization code');
    }

    const tokens = await this.authService.handleGitHubCallback({ code });
    const authCode = await this.authService.createAuthCode({ tokens });
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    res.redirect(`${frontendUrl}/auth/callback?code=${authCode}`);
  }

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async exchange(
    @Body(new ZodValidationPipe(ExchangeCodeSchema)) body: ExchangeCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const tokens = await this.authService.exchangeAuthCode({ code: body.code });
    this.setRefreshTokenCookie({ res, refreshToken: tokens.refreshToken });
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = this.getRefreshTokenFromCookie({ req });
    const tokens = await this.authService.refreshTokens({ refreshToken });
    this.setRefreshTokenCookie({ res, refreshToken: tokens.refreshToken });
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (refreshToken) {
      const accessToken = this.extractAccessToken({ req });
      await this.authService.logout({ refreshToken, accessToken });
    }
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      path: '/auth',
      httpOnly: true,
      sameSite: 'strict',
      secure: this.isProduction,
    });
  }

  private extractAccessToken({ req }: { req: Request }): string | undefined {
    const authorization = req.headers.authorization;
    if (!authorization) return undefined;
    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  private setRefreshTokenCookie({
    res,
    refreshToken,
  }: {
    res: Response;
    refreshToken: string;
  }): void {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.isProduction,
      path: '/auth',
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }

  private getRefreshTokenFromCookie({ req }: { req: Request }): string {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    return refreshToken;
  }

  private verifyState(state: string, storedState: string): boolean {
    const stateBuffer = Buffer.from(state);
    const storedBuffer = Buffer.from(storedState);
    if (stateBuffer.length !== storedBuffer.length) return false;
    return timingSafeEqual(stateBuffer, storedBuffer);
  }
}
