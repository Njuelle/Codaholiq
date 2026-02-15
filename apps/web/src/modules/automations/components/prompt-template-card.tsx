import { Button } from '@/common/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { useClipboard } from '@/common/hooks/use-clipboard';
import { Check, Copy } from 'lucide-react';
import type { ReactElement } from 'react';

interface PromptTemplateCardProps {
  readonly promptTemplate: string;
}

export function PromptTemplateCard({ promptTemplate }: PromptTemplateCardProps): ReactElement {
  const { isCopied, copy } = useClipboard();

  const handleCopy = (): void => {
    void copy(promptTemplate);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prompt Template</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {isCopied ? (
              <>
                <Check className="size-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy
              </>
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap overflow-auto rounded-md bg-muted p-4 text-sm font-mono">
          {promptTemplate}
        </pre>
      </CardContent>
    </Card>
  );
}
