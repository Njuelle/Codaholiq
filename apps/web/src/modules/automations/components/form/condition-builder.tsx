import { Button } from '@/common/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/common/components/ui/command';
import { Input } from '@/common/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/common/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import {
  getPayloadPathsForEvents,
  useGitHubEvents,
  type GitHubEventPayloadPath,
} from '@/modules/automations/hooks/use-github-events';
import {
  ALL_OPERATORS,
  OPERATOR_LABELS,
  VALUE_LESS_OPERATORS,
} from '@/modules/automations/lib/condition-operators';
import {
  getPresetsForEvents,
  type ConditionPreset,
} from '@/modules/automations/lib/condition-presets';
import type { ConditionGroup, ConditionOperator, TriggerCondition } from '@/common/types';
import { ChevronsUpDown, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';

// ── Types ────────────────────────────────────────────────────────────────

interface ConditionBuilderProps {
  readonly conditionGroups: readonly ConditionGroup[];
  readonly selectedEvents: readonly string[];
  readonly onChange: (groups: ConditionGroup[]) => void;
}

// ── ConditionPathCombobox ────────────────────────────────────────────────

function ConditionPathCombobox({
  value,
  payloadPaths,
  onChange,
}: Readonly<{
  value: string;
  payloadPaths: readonly GitHubEventPayloadPath[];
  onChange: (path: string) => void;
}>): ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Select field"
          className="w-[180px] justify-between font-mono text-xs"
        >
          <span className="truncate">{value || 'Select field…'}</span>
          <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search or type path…" />
          <CommandList>
            <CommandEmpty>
              <button
                type="button"
                className="text-primary w-full text-sm underline-offset-2 hover:underline"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Use custom path
              </button>
            </CommandEmpty>
            {payloadPaths.length > 0 && (
              <CommandGroup heading="Suggested fields">
                {payloadPaths.map((pp) => (
                  <CommandItem
                    key={pp.path}
                    value={pp.path}
                    onSelect={(selected: string) => {
                      onChange(selected);
                      setOpen(false);
                    }}
                  >
                    <span className="font-mono text-xs">{pp.path}</span>
                    <span className="text-muted-foreground ml-auto text-xs">{pp.description}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <div className="border-t p-2">
          <Input
            placeholder="Custom path (e.g. payload.field)"
            className="h-7 font-mono text-xs"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              onChange(e.target.value);
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setOpen(false);
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── ConditionRow ─────────────────────────────────────────────────────────

function ConditionRow({
  condition,
  payloadPaths,
  onChange,
  onRemove,
}: Readonly<{
  condition: TriggerCondition;
  payloadPaths: readonly GitHubEventPayloadPath[];
  onChange: (updated: TriggerCondition) => void;
  onRemove: () => void;
}>): ReactElement {
  const isValueLess = VALUE_LESS_OPERATORS.has(condition.operator);

  return (
    <div className="flex items-center gap-2">
      <ConditionPathCombobox
        value={condition.path}
        payloadPaths={payloadPaths}
        onChange={(path) => onChange({ ...condition, path })}
      />

      <Select
        value={condition.operator}
        onValueChange={(op: string) => {
          const operator = op as ConditionOperator;
          const updated: TriggerCondition = VALUE_LESS_OPERATORS.has(operator)
            ? { path: condition.path, operator }
            : { ...condition, operator };
          onChange(updated);
        }}
      >
        <SelectTrigger className="w-[150px] text-xs" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ALL_OPERATORS.map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!isValueLess && (
        <Input
          placeholder="Value"
          className="h-8 flex-1 font-mono text-xs"
          value={condition.value ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onChange({ ...condition, value: e.target.value });
          }}
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label="Remove condition"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}

// ── ConditionGroupCard ───────────────────────────────────────────────────

function ConditionGroupCard({
  group,
  groupIndex,
  payloadPaths,
  showGroupWrapper,
  onChange,
  onRemove,
}: Readonly<{
  group: ConditionGroup;
  groupIndex: number;
  payloadPaths: readonly GitHubEventPayloadPath[];
  showGroupWrapper: boolean;
  onChange: (updated: ConditionGroup) => void;
  onRemove: () => void;
}>): ReactElement {
  const updateCondition = useCallback(
    (condIdx: number, updated: TriggerCondition): void => {
      const newConditions = [...group.conditions];
      newConditions[condIdx] = updated;
      onChange({ conditions: newConditions });
    },
    [group.conditions, onChange],
  );

  const removeCondition = useCallback(
    (condIdx: number): void => {
      const newConditions = group.conditions.filter((_, i) => i !== condIdx);
      if (newConditions.length === 0) {
        onRemove();
      } else {
        onChange({ conditions: newConditions });
      }
    },
    [group.conditions, onChange, onRemove],
  );

  const addCondition = useCallback((): void => {
    onChange({
      conditions: [...group.conditions, { path: '', operator: 'equals', value: '' }],
    });
  }, [group.conditions, onChange]);

  const content = (
    <div className="space-y-2">
      {group.conditions.map((condition, condIdx) => (
        <div key={condIdx}>
          {condIdx > 0 && (
            <div className="flex items-center gap-2 py-1">
              <div className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-xs font-semibold uppercase">and</span>
              <div className="bg-border h-px flex-1" />
            </div>
          )}
          <ConditionRow
            condition={condition}
            payloadPaths={payloadPaths}
            onChange={(updated) => updateCondition(condIdx, updated)}
            onRemove={() => removeCondition(condIdx)}
          />
        </div>
      ))}

      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="ghost" size="xs" onClick={addCondition}>
          <Plus className="size-3" />
          Add condition
        </Button>
        {showGroupWrapper && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            aria-label={`Remove group ${groupIndex + 1}`}
          >
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );

  if (!showGroupWrapper) {
    return content;
  }

  return <div className="rounded-lg border p-3">{content}</div>;
}

// ── ConditionPreview ─────────────────────────────────────────────────────

function ConditionPreview({
  conditionGroups,
}: Readonly<{
  conditionGroups: readonly ConditionGroup[];
}>): ReactElement | null {
  if (conditionGroups.length === 0) return null;

  const hasContent = conditionGroups.some((g) => g.conditions.length > 0);
  if (!hasContent) return null;

  return (
    <div className="text-muted-foreground mt-3 text-sm" data-testid="condition-preview">
      <span className="text-foreground mr-1 font-medium">Runs when</span>
      {conditionGroups.map((group, gIdx) => (
        <span key={gIdx}>
          {gIdx > 0 && <span className="font-semibold"> OR </span>}
          {group.conditions.length > 1 && '('}
          {group.conditions.map((c, cIdx) => (
            <span key={cIdx}>
              {cIdx > 0 && <span className="font-semibold"> AND </span>}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {c.path || '…'}
              </code>{' '}
              <span>{OPERATOR_LABELS[c.operator]}</span>
              {!VALUE_LESS_OPERATORS.has(c.operator) && c.value && (
                <>
                  {' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    &quot;{c.value}&quot;
                  </code>
                </>
              )}
            </span>
          ))}
          {group.conditions.length > 1 && ')'}
        </span>
      ))}
    </div>
  );
}

// ── ConditionBuilder (main) ──────────────────────────────────────────────

export function ConditionBuilder({
  conditionGroups,
  selectedEvents,
  onChange,
}: ConditionBuilderProps): ReactElement {
  const { events: allEvents } = useGitHubEvents();

  const payloadPaths = useMemo(
    () => getPayloadPathsForEvents({ events: selectedEvents, allEvents }),
    [selectedEvents, allEvents],
  );

  const presets = useMemo(() => getPresetsForEvents(selectedEvents), [selectedEvents]);

  const mutableGroups = useMemo(
    () => conditionGroups.map((g) => ({ conditions: [...g.conditions] })),
    [conditionGroups],
  );

  const handlePresetClick = useCallback(
    (preset: ConditionPreset): void => {
      if (mutableGroups.length === 0) {
        onChange([{ conditions: [preset.condition] }]);
      } else {
        const updated = [...mutableGroups];
        updated[0] = {
          conditions: [...updated[0]!.conditions, preset.condition],
        };
        onChange(updated);
      }
    },
    [mutableGroups, onChange],
  );

  const updateGroup = useCallback(
    (groupIdx: number, updated: ConditionGroup): void => {
      const newGroups = [...mutableGroups];
      newGroups[groupIdx] = { conditions: [...updated.conditions] };
      onChange(newGroups);
    },
    [mutableGroups, onChange],
  );

  const removeGroup = useCallback(
    (groupIdx: number): void => {
      onChange(mutableGroups.filter((_, i) => i !== groupIdx));
    },
    [mutableGroups, onChange],
  );

  const addGroup = useCallback((): void => {
    onChange([...mutableGroups, { conditions: [{ path: '', operator: 'equals', value: '' }] }]);
  }, [mutableGroups, onChange]);

  const addCustomCondition = useCallback((): void => {
    if (mutableGroups.length === 0) {
      onChange([{ conditions: [{ path: '', operator: 'equals', value: '' }] }]);
    } else {
      const updated = [...mutableGroups];
      updated[0] = {
        conditions: [...updated[0]!.conditions, { path: '', operator: 'equals', value: '' }],
      };
      onChange(updated);
    }
  }, [mutableGroups, onChange]);

  const hasConditions =
    mutableGroups.length > 0 && mutableGroups.some((g) => g.conditions.length > 0);
  const showGroupWrappers = mutableGroups.length > 1;

  if (!hasConditions) {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Filter (optional)</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Add conditions to control exactly when this automation runs. Without conditions, every
              matching event triggers it.
            </p>
          </div>

          {presets.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.icon}
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button type="button" variant="ghost" size="sm" onClick={addCustomCondition}>
            <Plus className="size-3" />
            Add custom condition
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Conditions</p>
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset, idx) => (
            <Button
              key={idx}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => handlePresetClick(preset)}
            >
              {preset.icon}
              {preset.label}
            </Button>
          ))}
        </div>
      )}

      {mutableGroups.map((group, gIdx) => (
        <div key={gIdx}>
          {gIdx > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="bg-border h-px flex-1" />
              <span className="bg-muted text-muted-foreground rounded-full px-3 py-0.5 text-xs font-semibold uppercase">
                or
              </span>
              <div className="bg-border h-px flex-1" />
            </div>
          )}
          <ConditionGroupCard
            group={group}
            groupIndex={gIdx}
            payloadPaths={payloadPaths}
            showGroupWrapper={showGroupWrappers}
            onChange={(updated) => updateGroup(gIdx, updated)}
            onRemove={() => removeGroup(gIdx)}
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addGroup}>
        <Plus className="size-3" />
        Add OR group
      </Button>

      <ConditionPreview conditionGroups={mutableGroups} />
    </div>
  );
}
