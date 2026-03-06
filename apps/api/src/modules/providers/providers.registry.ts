import { Injectable, BadRequestException } from '@nestjs/common';
import type { ProviderDefinition, ProviderModel } from './provider.types';

export const PROVIDER_IDS = ['claude-code', 'opencode', 'codex', 'gemini'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const DEFAULT_PROVIDER_ID: ProviderId = 'claude-code';

const CLAUDE_CODE: ProviderDefinition = {
  id: 'claude-code',
  name: 'Claude Code',
  description: 'Anthropic Claude Code Action — agentic coding with Claude models',
  models: [
    {
      id: 'claude-sonnet-4-5-20250929',
      name: 'Claude Sonnet 4.5',
      description: 'Balanced speed and capability',
    },
    {
      id: 'claude-opus-4-6',
      name: 'Claude Opus 4.6',
      description: 'Most capable, best for complex tasks',
    },
    {
      id: 'claude-haiku-4-5-20251001',
      name: 'Claude Haiku 4.5',
      description: 'Fastest and most cost-effective',
    },
  ],
  defaultModelId: 'claude-sonnet-4-5-20250929',
  secrets: [
    { name: 'ANTHROPIC_API_KEY', required: false, description: 'Anthropic API key' },
    {
      name: 'CLAUDE_CODE_OAUTH_TOKEN',
      required: false,
      description: 'Claude Code OAuth token',
    },
  ],
  modelIdPattern: /^claude-[a-z0-9.-]+$/,
};

const OPENCODE: ProviderDefinition = {
  id: 'opencode',
  name: 'OpenCode',
  description: 'Multi-provider AI coding agent supporting 75+ models',
  models: [
    {
      id: 'anthropic/claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4 (via OpenCode)',
      description: 'Balanced speed and capability',
    },
    {
      id: 'anthropic/claude-opus-4-20250514',
      name: 'Claude Opus 4 (via OpenCode)',
      description: 'Most capable Anthropic model',
    },
    {
      id: 'openai/gpt-4.1',
      name: 'GPT-4.1 (via OpenCode)',
      description: 'OpenAI flagship model',
    },
    {
      id: 'openai/gpt-4.1-mini',
      name: 'GPT-4.1 Mini (via OpenCode)',
      description: 'Fast and cost-effective OpenAI model',
    },
    {
      id: 'openai/o4-mini',
      name: 'o4-mini (via OpenCode)',
      description: 'OpenAI reasoning model',
    },
    {
      id: 'google/gemini-2.5-pro',
      name: 'Gemini 2.5 Pro (via OpenCode)',
      description: 'Google flagship model',
    },
    {
      id: 'google/gemini-2.5-flash',
      name: 'Gemini 2.5 Flash (via OpenCode)',
      description: 'Fast and efficient Google model',
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek Chat (via OpenCode)',
      description: 'Open-source reasoning model',
    },
  ],
  defaultModelId: 'anthropic/claude-sonnet-4-20250514',
  secrets: [
    { name: 'ANTHROPIC_API_KEY', required: false, description: 'Required for Anthropic models' },
    { name: 'OPENAI_API_KEY', required: false, description: 'Required for OpenAI models' },
    { name: 'GEMINI_API_KEY', required: false, description: 'Required for Google models' },
  ],
  modelIdPattern: /^[a-z0-9-]+\/[a-z0-9._-]+$/,
};

const CODEX: ProviderDefinition = {
  id: 'codex',
  name: 'OpenAI Codex',
  description: 'OpenAI Codex coding agent',
  models: [
    {
      id: 'codex-mini',
      name: 'Codex Mini',
      description: 'Fast and cost-effective',
    },
    {
      id: 'o4-mini',
      name: 'o4-mini',
      description: 'General purpose reasoning model',
    },
  ],
  defaultModelId: 'codex-mini',
  secrets: [{ name: 'OPENAI_API_KEY', required: true, description: 'OpenAI API key' }],
  modelIdPattern: /^[a-z0-9-]+$/,
};

const GEMINI: ProviderDefinition = {
  id: 'gemini',
  name: 'Gemini CLI',
  description: 'Google Gemini CLI for GitHub Actions',
  models: [
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'Most capable Gemini model',
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Fast and efficient',
    },
  ],
  defaultModelId: 'gemini-2.5-pro',
  secrets: [{ name: 'GEMINI_API_KEY', required: true, description: 'Google Gemini API key' }],
  modelIdPattern: /^gemini-[a-z0-9.-]+$/,
};

const PROVIDERS: readonly ProviderDefinition[] = [CLAUDE_CODE, OPENCODE, CODEX, GEMINI];

const PROVIDER_MAP = new Map<string, ProviderDefinition>(PROVIDERS.map((p) => [p.id, p]));

@Injectable()
export class ProvidersRegistry {
  getAll(): readonly ProviderDefinition[] {
    return PROVIDERS;
  }

  getById(providerId: string): ProviderDefinition | undefined {
    return PROVIDER_MAP.get(providerId);
  }

  getByIdOrThrow(providerId: string): ProviderDefinition {
    const provider = PROVIDER_MAP.get(providerId);
    if (!provider) {
      throw new BadRequestException(`Unknown provider: ${providerId}`);
    }
    return provider;
  }

  getDefault(): ProviderDefinition {
    return CLAUDE_CODE;
  }

  getProviderIds(): readonly string[] {
    return PROVIDERS.map((p) => p.id);
  }

  validateModel({ providerId, modelId }: { providerId: string; modelId: string }): boolean {
    const provider = PROVIDER_MAP.get(providerId);
    if (!provider) return false;
    return provider.modelIdPattern.test(modelId);
  }

  getModelsForProvider(providerId: string): readonly ProviderModel[] {
    const provider = PROVIDER_MAP.get(providerId);
    return provider?.models ?? [];
  }

  /**
   * Build the workflow_dispatch inputs for a given provider.
   * The unified workflow file uses `provider`, `prompt`, and `model` inputs,
   * then conditional `if:` steps route to the correct action.
   */
  mapDispatchInputs({
    providerId,
    prompt,
    model,
  }: {
    providerId: string;
    prompt: string;
    model?: string | null;
  }): Record<string, string> {
    this.getByIdOrThrow(providerId);
    const inputs: Record<string, string> = {
      provider: providerId,
      prompt,
    };
    if (model) {
      inputs.model = model;
    }
    return inputs;
  }
}
