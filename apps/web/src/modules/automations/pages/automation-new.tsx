import { useState, type ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/common/components/page-header';
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
import type { CatalogTemplate } from '@/common/types';

export function AutomationNewPage(): ReactElement {
  const { orgId: orgIdParam } = useParams<{ orgId: string }>();
  const orgId = Number(orgIdParam);

  const { categories, isLoading } = useAutomationCatalog();
  const createFromTemplate = useCreateFromTemplate({ orgId });

  const [selectedTemplate, setSelectedTemplate] = useState<CatalogTemplate | null>(null);

  const handleTemplateSelect = (template: CatalogTemplate): void => {
    setSelectedTemplate(template);
  };

  const handleRepoConfirm = (repoId: number): void => {
    if (!selectedTemplate) return;
    createFromTemplate.mutate({
      templateSlug: selectedTemplate.slug,
      repoId,
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="New Automation"
        description="Choose a premade template or create a custom automation."
      />

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
        categories.map((category) => (
          <Collapsible key={category.name} defaultOpen={false}>
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
