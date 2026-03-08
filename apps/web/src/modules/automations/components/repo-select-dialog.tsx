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
import { useSetupStatus } from '@/modules/repositories/hooks/use-setup-status';
import { useProviders } from '@/modules/automations/hooks/use-providers';
import { DEFAULT_MODEL_SENTINEL } from '@/modules/automations/lib/constants';

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

  const { providerSecrets, isLoading: setupLoading } = useSetupStatus({
    orgId,
    repoId: selectedRepoId,
  });

  const configuredProviders = useMemo(() => {
    if (!selectedRepoId || !providerSecrets) return providers;
    const configuredIds = new Set(
      providerSecrets.filter((p) => p.configured).map((p) => p.providerId),
    );
    return providers.filter((p) => configuredIds.has(p.id));
  }, [selectedRepoId, providerSecrets, providers]);

  const effectiveProvider = useMemo(() => {
    const isSelectedAvailable = configuredProviders.some((p) => p.id === selectedProvider);
    if (isSelectedAvailable) return selectedProvider;
    const defaultAvailable = configuredProviders.some((p) => p.id === defaultProviderId);
    if (defaultAvailable) return defaultProviderId;
    const firstConfigured = configuredProviders[0];
    return firstConfigured ? firstConfigured.id : defaultProviderId;
  }, [configuredProviders, selectedProvider, defaultProviderId]);

  const availableSecretNames = useMemo(() => {
    if (!providerSecrets) return undefined;
    const names = new Set<string>();
    for (const ps of providerSecrets) {
      for (const s of ps.secrets) {
        if (s.exists) names.add(s.name);
      }
    }
    return names;
  }, [providerSecrets]);

  const allModels = useMemo(
    () => getModelsForProvider(effectiveProvider),
    [getModelsForProvider, effectiveProvider],
  );

  const models = useMemo(() => {
    if (!availableSecretNames) return allModels;
    return allModels.filter((m) => !m.requiredSecret || availableSecretNames.has(m.requiredSecret));
  }, [allModels, availableSecretNames]);

  const effectiveModel = useMemo(() => {
    if (selectedModel === null) return null;
    const modelExists = models.some((m) => m.id === selectedModel);
    return modelExists ? selectedModel : null;
  }, [selectedModel, models]);

  const defaultModelName = useMemo(() => {
    const defaultId = getDefaultModelId(effectiveProvider);
    if (!defaultId) return 'Default';
    const model = allModels.find((m) => m.id === defaultId);
    return model ? `Default (${model.name})` : 'Default';
  }, [getDefaultModelId, effectiveProvider, allModels]);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setSelectedRepoId(null);
      setSelectedProvider(defaultProviderId);
      setSelectedModel(null);
    }
    onOpenChange(nextOpen);
  };

  const handleRepoChange = (value: string): void => {
    setSelectedRepoId(Number(value));
    setSelectedModel(null);
  };

  const handleProviderChange = (value: string): void => {
    setSelectedProvider(value);
    setSelectedModel(null);
  };

  const handleConfirm = (): void => {
    if (selectedRepoId === null) return;
    onConfirm({
      repoId: selectedRepoId,
      provider: effectiveProvider,
      model: effectiveModel,
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
              onValueChange={handleRepoChange}
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

          {selectedRepoId !== null && !setupLoading && configuredProviders.length === 0 ? (
            <p className="text-sm text-destructive">
              No providers are configured on this repository. Please add the required API keys as
              repository secrets before creating an automation.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  disabled={setupLoading}
                  value={effectiveProvider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={setupLoading ? 'Loading...' : 'Select a provider'} />
                  </SelectTrigger>
                  <SelectContent>
                    {configuredProviders.map((provider) => (
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
                  value={effectiveModel ?? DEFAULT_MODEL_SENTINEL}
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              selectedRepoId === null ||
              isLoading ||
              setupLoading ||
              configuredProviders.length === 0
            }
          >
            {isLoading ? 'Creating...' : 'Create Automation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
