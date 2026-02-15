import { Badge } from '@/common/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/common/components/ui/table';
import type { AutomationVariable, VariableSource } from '@/common/types';
import { Check, X } from 'lucide-react';
import type { ReactElement } from 'react';

interface VariablesCardProps {
  readonly variables: readonly AutomationVariable[];
}

const SOURCE_LABELS: Record<VariableSource, string> = {
  static: 'Static',
  event_payload: 'Event Payload',
};

const SOURCE_VARIANTS: Record<VariableSource, 'default' | 'secondary' | 'outline'> = {
  static: 'secondary',
  event_payload: 'outline',
};

export function VariablesCard({ variables }: VariablesCardProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Variables
          <Badge variant="secondary">{variables.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {variables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No variables configured.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Required</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((variable) => (
                <TableRow key={variable.id}>
                  <TableCell className="font-mono text-sm">{variable.key}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{variable.value}</TableCell>
                  <TableCell>
                    <Badge variant={SOURCE_VARIANTS[variable.source]}>
                      {SOURCE_LABELS[variable.source]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {variable.required ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <X className="size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
