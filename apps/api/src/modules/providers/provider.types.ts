export interface ProviderModel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredSecret?: string;
}

export interface SecretRequirement {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly models: readonly ProviderModel[];
  readonly defaultModelId: string;
  readonly secrets: readonly SecretRequirement[];
  readonly modelIdPattern: RegExp;
}

export interface ProviderSecretStatus {
  readonly providerId: string;
  readonly providerName: string;
  readonly configured: boolean;
  readonly secrets: readonly { name: string; exists: boolean }[];
}

export interface ProviderListResponse {
  readonly providers: readonly ProviderDefinition[];
  readonly defaultProviderId: string;
}
