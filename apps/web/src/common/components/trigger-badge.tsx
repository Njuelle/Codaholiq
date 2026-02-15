import { Badge } from '@/common/components/ui/badge';
import { cn } from '@/common/lib/utils';
import type { TriggerType } from '@/common/types';
import { Clock, Hand, Webhook } from 'lucide-react';
import type { ReactElement } from 'react';

const TRIGGER_STYLES: Record<TriggerType, string> = {
  event: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cron: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  manual: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  event: 'Event',
  cron: 'Cron',
  manual: 'Manual',
};

const TRIGGER_ICONS: Record<TriggerType, typeof Webhook> = {
  event: Webhook,
  cron: Clock,
  manual: Hand,
};

interface TriggerBadgeProps {
  readonly triggerType: TriggerType;
  readonly className?: string;
}

export function TriggerBadge({ triggerType, className }: TriggerBadgeProps): ReactElement {
  const Icon = TRIGGER_ICONS[triggerType];

  return (
    <Badge variant="outline" className={cn(TRIGGER_STYLES[triggerType], className)}>
      <Icon className="size-3" />
      {TRIGGER_LABELS[triggerType]}
    </Badge>
  );
}
