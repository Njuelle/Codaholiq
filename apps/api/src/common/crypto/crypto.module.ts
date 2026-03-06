import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { SecretMaskingService } from './secret-masking.service';

@Global()
@Module({
  providers: [EncryptionService, SecretMaskingService],
  exports: [EncryptionService, SecretMaskingService],
})
export class CryptoModule {}
