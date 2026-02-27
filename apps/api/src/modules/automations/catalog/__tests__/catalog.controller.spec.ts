import { CatalogController } from '../catalog.controller';
import { CatalogService } from '../catalog.service';
import type { CatalogCategory } from '../catalog.types';

describe('CatalogController', () => {
  let controller: CatalogController;
  let catalogService: { getCategories: ReturnType<typeof vi.fn> };

  const mockCategories: CatalogCategory[] = [
    {
      name: 'Code Quality',
      templates: [
        {
          slug: 'pr-code-review',
          name: 'PR Code Review',
          description: 'Reviews pull requests.',
          category: 'Code Quality',
          icon: 'search-code',
          triggerType: 'event',
          triggerConfig: { events: ['pull_request.opened'] },
          promptTemplate: 'Review the PR.',
          provider: 'claude-code',
          model: null,
          variables: [],
        },
      ],
    },
  ];

  beforeEach(() => {
    catalogService = {
      getCategories: vi.fn().mockReturnValue(mockCategories),
    };

    controller = new CatalogController(catalogService as unknown as CatalogService);
  });

  describe('getCategories', () => {
    it('should return categories from the catalog service', () => {
      const result = controller.getCategories();

      expect(result).toEqual({ categories: mockCategories });
      expect(catalogService.getCategories).toHaveBeenCalledTimes(1);
    });

    it('should return empty categories when no templates exist', () => {
      catalogService.getCategories.mockReturnValue([]);

      const result = controller.getCategories();

      expect(result).toEqual({ categories: [] });
    });
  });
});
