import { Button } from '@/common/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/common/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/common/components/ui/form';
import { Input } from '@/common/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import { Textarea } from '@/common/components/ui/textarea';
import type { Repository } from '@/modules/repositories/types';
import type { SharedVariable } from '@/modules/variables/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const variableFormSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .max(100)
    .regex(/^[a-zA-Z0-9_.]+$/, 'Only letters, numbers, dots, and underscores'),
  value: z.string().min(1, 'Value is required').max(10000),
  description: z.string().max(500).optional(),
  scope: z.string().min(1, 'Scope is required'),
});

type VariableFormValues = z.infer<typeof variableFormSchema>;

const ORG_SCOPE = 'org';

interface SharedVariableDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly variable?: SharedVariable | null;
  readonly repos: readonly Repository[];
  readonly onSubmit: (values: {
    key: string;
    value: string;
    description?: string;
    repoId?: number;
  }) => void;
  readonly isSubmitting: boolean;
}

export function SharedVariableDialog({
  open,
  onOpenChange,
  variable,
  repos,
  onSubmit,
  isSubmitting,
}: SharedVariableDialogProps): ReactElement {
  const isEditing = variable !== null && variable !== undefined;

  const form = useForm<VariableFormValues>({
    resolver: zodResolver(variableFormSchema),
    defaultValues: {
      key: '',
      value: '',
      description: '',
      scope: ORG_SCOPE,
    },
  });

  useEffect(() => {
    if (open) {
      if (variable) {
        form.reset({
          key: variable.key,
          value: variable.value,
          description: variable.description ?? '',
          scope: variable.repoId ? String(variable.repoId) : ORG_SCOPE,
        });
      } else {
        form.reset({
          key: '',
          value: '',
          description: '',
          scope: ORG_SCOPE,
        });
      }
    }
  }, [open, variable, form]);

  const handleSubmit = (values: VariableFormValues): void => {
    const repoId = values.scope === ORG_SCOPE ? undefined : Number(values.scope);
    onSubmit({
      key: values.key,
      value: values.value,
      description: values.description || undefined,
      repoId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Variable' : 'Add Variable'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)} className="space-y-4">
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="api_url"
                      disabled={isEditing}
                      className="font-mono"
                    />
                  </FormControl>
                  <FormDescription>Use in prompts as {'{{key}}'}.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Enter value..." rows={3} />
                  </FormControl>
                  <FormDescription>
                    Do not store secrets or sensitive credentials here. Values are stored in plain
                    text.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="What this variable is used for" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={ORG_SCOPE}>Organization-wide</SelectItem>
                      {repos.map((repo) => (
                        <SelectItem key={repo.id} value={String(repo.id)}>
                          {repo.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Repo-scoped variables only appear when that repo is selected.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isEditing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
