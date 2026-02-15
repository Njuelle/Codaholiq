import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import { createHmac } from 'crypto';
import { WebhooksController } from '../webhooks.controller';
import { WebhooksGuard } from '../webhooks.guard';
import { WEBHOOK_QUEUE } from '../webhooks.constants';
import { REDIS } from '../../redis/redis.constants';

const TEST_SECRET = 'test-webhook-secret';

function signPayload(body: string): string {
  return 'sha256=' + createHmac('sha256', TEST_SECRET).update(body).digest('hex');
}

describe('WebhooksController', () => {
  let app: INestApplication;
  const addMock = vi.fn().mockResolvedValue({});

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        WebhooksGuard,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue(TEST_SECRET),
          },
        },
        {
          provide: getQueueToken(WEBHOOK_QUEUE),
          useValue: { add: addMock },
        },
        {
          provide: REDIS,
          useValue: { set: vi.fn().mockResolvedValue('OK') },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    addMock.mockClear();
  });

  describe('POST /webhooks/github', () => {
    it('should return 200 and queue job for valid signed webhook', async () => {
      const payload = { action: 'created', installation: { id: 12345 } };
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      const response = await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-event', 'installation')
        .set('x-github-delivery', 'delivery-abc-123')
        .send(body)
        .expect(200);

      expect(response.body).toEqual({ received: true });
      expect(addMock).toHaveBeenCalledOnce();
      expect(addMock).toHaveBeenCalledWith(
        'installation.created',
        {
          event: 'installation',
          action: 'created',
          deliveryId: 'delivery-abc-123',
          payload: expect.objectContaining({ action: 'created' }),
        },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }),
      );
    });

    it('should use event name only when action is missing', async () => {
      const payload = { ref: 'refs/heads/main' };
      const body = JSON.stringify(payload);
      const signature = signPayload(body);

      await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .set('x-github-event', 'push')
        .set('x-github-delivery', 'delivery-push-456')
        .send(body)
        .expect(200);

      expect(addMock).toHaveBeenCalledWith(
        'push',
        expect.objectContaining({ event: 'push', action: '' }),
        expect.any(Object),
      );
    });

    it('should return 400 when signature header is missing', async () => {
      const payload = { action: 'created' };
      const body = JSON.stringify(payload);

      await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('x-github-event', 'installation')
        .set('x-github-delivery', 'delivery-123')
        .send(body)
        .expect(400);

      expect(addMock).not.toHaveBeenCalled();
    });

    it('should return 400 when event header is missing', async () => {
      const payload = { action: 'created' };
      const body = JSON.stringify(payload);

      await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signPayload(body))
        .set('x-github-delivery', 'delivery-123')
        .send(body)
        .expect(400);

      expect(addMock).not.toHaveBeenCalled();
    });

    it('should return 400 when delivery header is missing', async () => {
      const payload = { action: 'created' };
      const body = JSON.stringify(payload);

      await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signPayload(body))
        .set('x-github-event', 'installation')
        .send(body)
        .expect(400);

      expect(addMock).not.toHaveBeenCalled();
    });

    it('should return 401 when signature is invalid', async () => {
      const payload = { action: 'created' };
      const body = JSON.stringify(payload);

      await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', 'sha256=invalid')
        .set('x-github-event', 'installation')
        .set('x-github-delivery', 'delivery-123')
        .send(body)
        .expect(401);

      expect(addMock).not.toHaveBeenCalled();
    });
  });
});
