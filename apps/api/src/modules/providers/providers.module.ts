import { Global, Module } from '@nestjs/common';
import { ProvidersRegistry } from './providers.registry';
import { ProvidersController } from './providers.controller';

@Global()
@Module({
  controllers: [ProvidersController],
  providers: [ProvidersRegistry],
  exports: [ProvidersRegistry],
})
export class ProvidersModule {}
