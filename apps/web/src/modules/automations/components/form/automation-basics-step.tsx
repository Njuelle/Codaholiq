import {
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
import { useRepos } from '@/modules/repositories/hooks/use-repos';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { useEffect, useMemo, type ReactElement } from 'react';
import type { Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';

interface AutomationBasicsStepProps {
  readonly control: Control<AutomationFormValues>;
  readonly watch: UseFormWatch<AutomationFormValues>;
  readonly setValue: UseFormSetValue<AutomationFormValues>;
  readonly orgId: number;
}

export function AutomationBasicsStep({
  control,
  watch,
  setValue,
  orgId,
}: AutomationBasicsStepProps): ReactElement {
  const { repos, isLoading } = useRepos({ orgId });
  const repoId = watch('repoId');

  useEffect(() => {
    if (repos.length === 1 && !repoId && repos[0]) {
      setValue('repoId', repos[0].id, { shouldValidate: true, shouldDirty: false });
    }
  }, [repos, repoId, setValue]);

  const selectedRepo = useMemo(() => repos.find((r) => r.id === repoId), [repos, repoId]);

  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g. Auto-review PRs" {...field} />
            </FormControl>
            <FormDescription>A descriptive name for this automation.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Optional description of what this automation does..."
                {...field}
                value={field.value ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="repoId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Repository</FormLabel>
            <Select
              disabled={isLoading}
              value={field.value ? String(field.value) : ''}
              onValueChange={(value: string) => field.onChange(Number(value))}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={isLoading ? 'Loading repositories...' : 'Select a repository'}
                  >
                    {selectedRepo?.fullName}
                  </SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {repos.map((repo) => (
                  <SelectItem key={repo.id} value={String(repo.id)}>
                    {repo.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>The GitHub repository this automation targets.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
