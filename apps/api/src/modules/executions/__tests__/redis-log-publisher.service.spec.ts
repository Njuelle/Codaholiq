import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisLogPublisherService } from '../redis-log-publisher.service';

const mockPublish = vi.fn().mockResolvedValue(1);
const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockQuit = vi.fn().mockResolvedValue('OK');

vi.mock('ioredis', () => ({
  default: vi.fn(function () {
    return {
      publish: mockPublish,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      on: mockOn,
      off: mockOff,
      quit: mockQuit,
    };
  }),
}));

describe('RedisLogPublisherService', () => {
  let service: RedisLogPublisherService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        RedisLogPublisherService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue('redis://localhost:6379'),
          },
        },
      ],
    }).compile();

    service = moduleFixture.get(RedisLogPublisherService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishLog', () => {
    it('should publish a log message to the correct Redis channel', async () => {
      await service.publishLog({
        executionId: 42,
        log: { level: 'info', message: 'hello' },
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'exec:logs:42',
        JSON.stringify({
          type: 'log',
          data: JSON.stringify({ level: 'info', message: 'hello' }),
        }),
      );
    });
  });

  describe('publishStatus', () => {
    it('should publish a status message to the correct Redis channel', async () => {
      await service.publishStatus({ executionId: 7, status: 'completed' });

      expect(mockPublish).toHaveBeenCalledWith(
        'exec:logs:7',
        JSON.stringify({
          type: 'status',
          data: JSON.stringify({ status: 'completed' }),
        }),
      );
    });
  });

  describe('subscribe', () => {
    it('should subscribe to the Redis channel and register a handler', () => {
      const onMessage = vi.fn();
      service.subscribe({ executionId: 99, onMessage });

      expect(mockSubscribe).toHaveBeenCalledWith('exec:logs:99');
      expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should invoke onMessage when a matching channel message arrives', () => {
      const onMessage = vi.fn();
      service.subscribe({ executionId: 5, onMessage });

      // Extract the handler registered via mockOn
      const handler = mockOn.mock.calls[mockOn.mock.calls.length - 1][1] as (
        ch: string,
        raw: string,
      ) => void;

      const message = JSON.stringify({ type: 'log', data: '{"line":"test"}' });
      handler('exec:logs:5', message);

      expect(onMessage).toHaveBeenCalledWith({ type: 'log', data: '{"line":"test"}' });
    });

    it('should not invoke onMessage for a different channel', () => {
      const onMessage = vi.fn();
      service.subscribe({ executionId: 5, onMessage });

      const handler = mockOn.mock.calls[mockOn.mock.calls.length - 1][1] as (
        ch: string,
        raw: string,
      ) => void;

      handler('exec:logs:999', '{}');

      expect(onMessage).not.toHaveBeenCalled();
    });

    it('should return an unsubscribe function', () => {
      const onMessage = vi.fn();
      const unsubscribe = service.subscribe({ executionId: 10, onMessage });

      unsubscribe();

      expect(mockOff).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockUnsubscribe).toHaveBeenCalledWith('exec:logs:10');
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit both Redis clients', async () => {
      await service.onModuleDestroy();

      expect(mockQuit).toHaveBeenCalledTimes(2);
    });
  });
});
