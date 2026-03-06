import { useMemo, useState, type ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '@/common/components/page-header';
import { Input } from '@/common/components/ui/input';
import { Skeleton } from '@/common/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/common/components/ui/collapsible';
import { useAutomationCatalog } from '@/modules/automations/hooks/use-automation-catalog';
import { useCreateFromTemplate } from '@/modules/automations/hooks/use-create-from-template';
import { CatalogTemplateCard } from '@/modules/automations/components/catalog-template-card';
import { CustomAutomationCard } from '@/modules/automations/components/custom-automation-card';
import { RepoSelectDialog } from '@/modules/automations/components/repo-select-dialog';
import type { CatalogCategory, CatalogTemplate } from '@/common/types';

function filterCategories({
  categories,
  query,
}: {
  categories: readonly CatalogCategory[];
  query: string;
}): CatalogCategory[] {
  const lower = query.toLowerCase();
  return categories
    .map((category) => {
      if (category.name.toLowerCase().includes(lower)) {
        return category;
      }
      const filtered = category.templates.filter(
        (t) => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower),
      );
      if (filtered.length === 0) return null;
      return { ...category, templates: filtered };
    })
    .filter((c): c is CatalogCategory => c !== null);
}

export function AutomationNewPage(): ReactElement {
  const { orgId: orgIdParam } = useParams<{ orgId: string }>();
  const orgId = Number(orgIdParam);

  const { categories, isLoading } = useAutomationCatalog();
  const createFromTemplate = useCreateFromTemplate({ orgId });

  const [selectedTemplate, setSelectedTemplate] = useState<CatalogTemplate | null>(null);
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(
    () => (search ? filterCategories({ categories, query: search }) : categories),
    [categories, search],
  );

  const handleTemplateSelect = (template: CatalogTemplate): void => {
    setSelectedTemplate(template);
  };

  const handleRepoConfirm = ({
    repoId,
    provider,
    model,
  }: {
    repoId: number;
    provider: string;
    model: string | null;
  }): void => {
    if (!selectedTemplate) return;
    createFromTemplate.mutate({
      templateSlug: selectedTemplate.slug,
      repoId,
      provider,
      model,
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="New Automation"
        description="Choose a premade template or create a custom automation."
      />

      {!isLoading && categories.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      )}

      {!isLoading &&
        filteredCategories.map((category) => (
          <Collapsible
            key={`${category.name}-${search.length > 0}`}
            defaultOpen={search.length > 0}
          >
            <CollapsibleTrigger className="group inline-flex items-center gap-2 text-lg font-semibold">
              <ChevronRight className="h-5 w-5 transition-transform group-data-[state=open]:rotate-90" />
              <span>{category.name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                ({category.templates.length})
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {category.templates.map((template) => (
                  <CatalogTemplateCard
                    key={template.slug}
                    template={template}
                    onSelect={handleTemplateSelect}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}

      {!isLoading && search && filteredCategories.length === 0 && (
        <p className="text-sm text-muted-foreground">No templates match your search.</p>
      )}

      {!isLoading && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Custom</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CustomAutomationCard />
          </div>
        </section>
      )}

      <RepoSelectDialog
        open={selectedTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTemplate(null);
        }}
        orgId={orgId}
        templateName={selectedTemplate?.name ?? ''}
        onConfirm={handleRepoConfirm}
        isLoading={createFromTemplate.isPending}
      />
    </div>
  );
}
