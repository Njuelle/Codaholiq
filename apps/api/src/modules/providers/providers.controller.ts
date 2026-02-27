import { Controller, Get, Param, NotFoundException, Inject } from '@nestjs/common';
import { ProvidersRegistry, DEFAULT_PROVIDER_ID } from './providers.registry';
import type { ProviderListResponse, ProviderDefinition } from './provider.types';

@Controller()
export class ProvidersController {
  constructor(@Inject(ProvidersRegistry) private readonly registry: ProvidersRegistry) {}

  @Get('providers')
  listProviders(): ProviderListResponse {
    return {
      providers: this.registry.getAll(),
      defaultProviderId: DEFAULT_PROVIDER_ID,
    };
  }

  @Get('providers/:providerId')
  getProvider(@Param('providerId') providerId: string): ProviderDefinition {
    const provider = this.registry.getById(providerId);
    if (!provider) {
      throw new NotFoundException(`Provider not found: ${providerId}`);
    }
    return provider;
  }
}
