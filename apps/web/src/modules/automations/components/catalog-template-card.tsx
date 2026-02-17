import type { ReactElement } from 'react';
import {
  SearchCode,
  Shield,
  Tag,
  Clock,
  FileText,
  Wrench,
  GitPullRequest,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/common/components/ui/card';
import { Badge } from '@/common/components/ui/badge';
import type { CatalogTemplate } from '@/common/types';

const ICON_MAP: Record<string, LucideIcon> = {
  'search-code': SearchCode,
  shield: Shield,
  tag: Tag,
  clock: Clock,
  'file-text': FileText,
  wrench: Wrench,
  'git-pull-request': GitPullRequest,
};

const TRIGGER_LABELS: Record<string, string> = {
  event: 'Event',
  cron: 'Scheduled',
  manual: 'Manual',
};

interface CatalogTemplateCardProps {
  readonly template: CatalogTemplate;
  readonly onSelect: (template: CatalogTemplate) => void;
}

export function CatalogTemplateCard({
  template,
  onSelect,
}: CatalogTemplateCardProps): ReactElement {
  const Icon = ICON_MAP[template.icon] ?? Zap;

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary"
      onClick={() => onSelect(template)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(template);
        }
      }}
    >
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
            <Icon className="text-muted-foreground h-5 w-5" />
          </div>
          <Badge variant="secondary">{TRIGGER_LABELS[template.triggerType]}</Badge>
        </div>
        <CardTitle className="text-base">{template.name}</CardTitle>
        <CardDescription className="line-clamp-2">{template.description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
