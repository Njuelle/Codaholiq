import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { LoggingModule } from '../logging.module';

describe('LoggingModule', () => {
  it('should provide PinoLogger', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), LoggingModule.forRoot()],
    }).compile();

    const logger = await moduleFixture.resolve(PinoLogger);
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should instantiate without errors in test environment', async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ NODE_ENV: 'test' })],
        }),
        LoggingModule.forRoot(),
      ],
    }).compile();

    expect(moduleFixture).toBeDefined();
  });
});
