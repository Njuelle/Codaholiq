import { Controller, Get, Inject } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import type { CatalogCategory } from './catalog.types';

@Controller('automation-catalog')
export class CatalogController {
  constructor(
    @Inject(CatalogService)
    private readonly catalogService: CatalogService,
  ) {}

  @Get()
  getCategories(): { categories: readonly CatalogCategory[] } {
    return { categories: this.catalogService.getCategories() };
  }
}
