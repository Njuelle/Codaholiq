import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class WebhooksGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;
    const eventHeader = request.headers['x-github-event'] as string | undefined;
    const deliveryHeader = request.headers['x-github-delivery'] as string | undefined;

    if (!signatureHeader || !eventHeader || !deliveryHeader) {
      throw new BadRequestException('Missing required GitHub webhook headers');
    }

    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw body for signature verification');
    }

    const secret = this.configService.getOrThrow<string>('GITHUB_WEBHOOK_SECRET');
    const expectedSignature =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
