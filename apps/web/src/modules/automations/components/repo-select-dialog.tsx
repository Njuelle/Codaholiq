import { useMemo, useState, type ReactElement } from 'react';
import { Button } from '@/common/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/common/components/ui/dialog';
import { Label } from '@/common/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import { useRepos } from '@/modules/repositories/hooks/use-repos';
import { useProviders } from '@/modules/automations/hooks/use-providers';

const DEFAULT_MODEL_SENTINEL = '__default__';

interface RepoSelectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orgId: number;
  readonly templateName: string;
  readonly onConfirm: (params: { repoId: number; provider: string; model: string | null }) => void;
  readonly isLoading: boolean;
}

export function RepoSelectDialog({
  open,
  onOpenChange,
  orgId,
  templateName,
  onConfirm,
  isLoading,
}: RepoSelectDialogProps): ReactElement {
  const { repos, isLoading: reposLoading } = useRepos({ orgId });
  const { providers, defaultProviderId, getModelsForProvider, getDefaultModelId } = useProviders();

  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>(defaultProviderId);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const models = useMemo(
    () => getModelsForProvider(selectedProvider),
    [getModelsForProvider, selectedProvider],
  );

  const defaultModelName = useMemo(() => {
    const defaultId = getDefaultModelId(selectedProvider);
    if (!defaultId) return 'Default';
    const model = models.find((m) => m.id === defaultId);
    return model ? `Default (${model.name})` : 'Default';
  }, [getDefaultModelId, selectedProvider, models]);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setSelectedRepoId(null);
      setSelectedProvider(defaultProviderId);
      setSelectedModel(null);
    }
    onOpenChange(nextOpen);
  };

  const handleProviderChange = (value: string): void => {
    setSelectedProvider(value);
    setSelectedModel(null);
  };

  const handleConfirm = (): void => {
    if (selectedRepoId === null) return;
    onConfirm({
      repoId: selectedRepoId,
      provider: selectedProvider,
      model: selectedModel,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Automation</DialogTitle>
          <DialogDescription>
            Choose a repository and AI provider for the <strong>{templateName}</strong> automation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Repository</Label>
            <Select
              disabled={reposLoading}
              value={selectedRepoId !== null ? String(selectedRepoId) : ''}
              onValueChange={(value: string) => setSelectedRepoId(Number(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={reposLoading ? 'Loading...' : 'Select a repository'} />
              </SelectTrigger>
              <SelectContent>
                {repos.map((repo) => (
                  <SelectItem key={repo.id} value={String(repo.id)}>
                    {repo.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={selectedModel ?? DEFAULT_MODEL_SENTINEL}
                onValueChange={(value: string) =>
                  setSelectedModel(value === DEFAULT_MODEL_SENTINEL ? null : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_MODEL_SENTINEL}>{defaultModelName}</SelectItem>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedRepoId === null || isLoading}>
            {isLoading ? 'Creating...' : 'Create Automation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
