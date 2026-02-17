export interface CatalogVariable {
  readonly key: string;
  readonly value: string;
  readonly source: 'static' | 'event_payload';
  readonly required: boolean;
}

export interface CatalogTemplate {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly icon: string;
  readonly triggerType: 'event' | 'cron' | 'manual';
  readonly triggerConfig: Record<string, unknown>;
  readonly promptTemplate: string;
  readonly model: string | null;
  readonly variables: readonly CatalogVariable[];
}

export interface CatalogCategory {
  readonly name: string;
  readonly templates: readonly CatalogTemplate[];
}
