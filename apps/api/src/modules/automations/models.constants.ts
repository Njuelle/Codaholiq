export interface ClaudeModel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const SUPPORTED_MODELS: readonly ClaudeModel[] = [
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
];

export const SUPPORTED_MODEL_IDS: readonly string[] = SUPPORTED_MODELS.map((m) => m.id);

/** The model used when none is explicitly selected (null in DB). */
export const DEFAULT_MODEL = SUPPORTED_MODELS[0];
