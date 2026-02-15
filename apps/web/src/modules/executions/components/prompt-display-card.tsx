import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Button } from '@/common/components/ui/button';
import { useClipboard } from '@/common/hooks/use-clipboard';
import { Check, Copy } from 'lucide-react';
import type { ReactElement } from 'react';

interface PromptDisplayCardProps {
  readonly prompt: string;
}

export function PromptDisplayCard({ prompt }: PromptDisplayCardProps): ReactElement {
  const { isCopied, copy } = useClipboard();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resolved Prompt</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void copy(prompt)}
            aria-label="Copy prompt"
          >
            {isCopied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm font-mono">
          {prompt}
        </pre>
      </CardContent>
    </Card>
  );
}
