import { Global, Module } from '@nestjs/common';
import { SanitizationService } from './sanitization.service';

@Global()
@Module({
  providers: [SanitizationService],
  exports: [SanitizationService],
})
export class SanitizationModule {}
