import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/common/components/ui/card';

export function CustomAutomationCard(): ReactElement {
  return (
    <Link to="custom" className="block">
      <Card className="cursor-pointer border-dashed transition-colors hover:border-primary">
        <CardHeader className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed">
            <Plus className="text-muted-foreground h-5 w-5" />
          </div>
          <CardTitle className="text-base">Custom Automation</CardTitle>
          <CardDescription className="line-clamp-2">
            Build a custom automation from scratch with full control over triggers, conditions, and
            prompts.
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
