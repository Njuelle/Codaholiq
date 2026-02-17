import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { CatalogTemplateYamlSchema } from './catalog.schema';
import type { CatalogTemplate, CatalogCategory } from './catalog.types';

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);
  private templates: ReadonlyMap<string, CatalogTemplate> = new Map();
  private categories: readonly CatalogCategory[] = [];

  onModuleInit(): void {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    const templatesDir = path.join(__dirname, 'templates');

    if (!fs.existsSync(templatesDir)) {
      this.logger.warn(`Catalog templates directory not found: ${templatesDir}`);
      return;
    }

    const files = fs
      .readdirSync(templatesDir)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    const loaded = new Map<string, CatalogTemplate>();

    for (const file of files) {
      try {
        const slug = path.basename(file, path.extname(file));
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
        const parsed: unknown = parseYaml(content);
        const result = CatalogTemplateYamlSchema.safeParse(parsed);

        if (!result.success) {
          this.logger.error(`Invalid catalog template "${file}": ${result.error.message}`);
          continue;
        }

        loaded.set(slug, {
          slug,
          ...result.data,
          triggerConfig: result.data.triggerConfig as Record<string, unknown>,
        });
      } catch (error) {
        this.logger.error(
          `Failed to load catalog template "${file}": ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.templates = loaded;
    this.categories = this.groupByCategory([...loaded.values()]);
    this.logger.log(
      `Loaded ${loaded.size} catalog templates in ${this.categories.length} categories`,
    );
  }

  private groupByCategory(templates: CatalogTemplate[]): readonly CatalogCategory[] {
    const grouped = new Map<string, CatalogTemplate[]>();

    for (const template of templates) {
      const list = grouped.get(template.category) ?? [];
      list.push(template);
      grouped.set(template.category, list);
    }

    return [...grouped.entries()]
      .map(([name, items]) => ({ name, templates: items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getCategories(): readonly CatalogCategory[] {
    return this.categories;
  }

  getTemplateBySlug({ slug }: { slug: string }): CatalogTemplate | undefined {
    return this.templates.get(slug);
  }
}
