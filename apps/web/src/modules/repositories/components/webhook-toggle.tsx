import { Label } from '@/common/components/ui/label';
import { Switch } from '@/common/components/ui/switch';
import type { ReactElement } from 'react';

interface WebhookToggleProps {
  readonly isActive: boolean;
  readonly onToggle: (active: boolean) => void;
  readonly isPending: boolean;
  readonly canEdit: boolean;
}

export function WebhookToggle({
  isActive,
  onToggle,
  isPending,
  canEdit,
}: WebhookToggleProps): ReactElement {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor="webhook-toggle" className="text-sm">
        Webhook processing
      </Label>
      <Switch
        id="webhook-toggle"
        checked={isActive}
        onCheckedChange={onToggle}
        disabled={!canEdit || isPending}
      />
    </div>
  );
}
