import { useState, useMemo, useCallback, type ReactElement } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Button } from '@/common/components/ui/button';
import { Checkbox } from '@/common/components/ui/checkbox';
import { Badge } from '@/common/components/ui/badge';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useModelPolicies } from '@/modules/repositories/hooks/use-model-policies';
import { useSetModelPolicies } from '@/modules/repositories/hooks/use-set-model-policies';
import { useProviders } from '@/modules/automations/hooks/use-providers';
import { Shield, Pencil, X } from 'lucide-react';

interface ModelPolicyCardProps {
  readonly orgId: number;
  readonly repoId: number;
  readonly canManage: boolean;
}

interface PolicySelection {
  readonly provider: string;
  readonly model: string;
}

export function ModelPolicyCard({ orgId, repoId, canManage }: ModelPolicyCardProps): ReactElement {
  const { policies, isRestricted, isLoading } = useModelPolicies({ orgId, repoId });
  const { providers } = useProviders();
  const setModelPolicies = useSetModelPolicies({ orgId, repoId });
  const [isEditing, setIsEditing] = useState(false);
  const [selected, setSelected] = useState<PolicySelection[]>([]);

  const startEditing = useCallback((): void => {
    setSelected(policies.map((p) => ({ provider: p.provider, model: p.model })));
    setIsEditing(true);
  }, [policies]);

  const cancelEditing = useCallback((): void => {
    setIsEditing(false);
    setSelected([]);
  }, []);

  const toggleModel = useCallback(
    ({ provider, model }: { provider: string; model: string }): void => {
      setSelected((prev) => {
        const exists = prev.some((s) => s.provider === provider && s.model === model);
        if (exists) {
          return prev.filter((s) => !(s.provider === provider && s.model === model));
        }
        return [...prev, { provider, model }];
      });
    },
    [],
  );

  const isSelected = useCallback(
    ({ provider, model }: { provider: string; model: string }): boolean =>
      selected.some((s) => s.provider === provider && s.model === model),
    [selected],
  );

  const handleSave = useCallback((): void => {
    setModelPolicies.mutate({ policies: selected }, { onSuccess: () => setIsEditing(false) });
  }, [selected, setModelPolicies]);

  const allowedSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of policies) {
      set.add(`${p.provider}:${p.model}`);
    }
    return set;
  }, [policies]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Model Policy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Model Policy
          </CardTitle>
          {canManage && !isEditing && (
            <Button variant="ghost" size="sm" onClick={startEditing}>
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          )}
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={cancelEditing}>
              <X className="mr-1 h-3 w-3" />
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Select models that are allowed on this repository. Leaving all unchecked removes
              restrictions.
            </p>
            {providers.map((provider) => (
              <div key={provider.id} className="space-y-2">
                <span className="text-sm font-medium">{provider.name}</span>
                <div className="ml-4 space-y-1.5">
                  {provider.models.map((model) => (
                    <label
                      key={model.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={isSelected({ provider: provider.id, model: model.id })}
                        onCheckedChange={() =>
                          toggleModel({ provider: provider.id, model: model.id })
                        }
                      />
                      {model.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSave} disabled={setModelPolicies.isPending}>
                {setModelPolicies.isPending ? 'Saving...' : 'Save Policy'}
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEditing}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {!isRestricted ? (
              <p className="text-muted-foreground text-sm">
                All models are allowed on this repository.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm mb-3">
                  Only the following models are allowed:
                </p>
                {providers
                  .filter((p) => p.models.some((m) => allowedSet.has(`${p.id}:${m.id}`)))
                  .map((provider) => (
                    <div key={provider.id} className="space-y-1">
                      <span className="text-sm font-medium">{provider.name}</span>
                      <div className="ml-4 flex flex-wrap gap-1">
                        {provider.models
                          .filter((m) => allowedSet.has(`${provider.id}:${m.id}`))
                          .map((model) => (
                            <Badge key={model.id} variant="secondary">
                              {model.name}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
