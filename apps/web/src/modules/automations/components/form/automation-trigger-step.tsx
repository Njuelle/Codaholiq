import { Button } from '@/common/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/common/components/ui/form';
import { Input } from '@/common/components/ui/input';
import { Label } from '@/common/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/common/components/ui/radio-group';
import { ConditionBuilder } from './condition-builder';
import { EventCategoryPicker } from './event-category-picker';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import type { ConditionGroup } from '@/common/types';
import { formatCronExpression } from '@/common/lib/format';
import { Clock, Info } from 'lucide-react';
import { useCallback, useMemo, type ReactElement } from 'react';
import type { Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';

interface AutomationTriggerStepProps {
  readonly control: Control<AutomationFormValues>;
  readonly watch: UseFormWatch<AutomationFormValues>;
  readonly setValue: UseFormSetValue<AutomationFormValues>;
}

const CRON_PRESETS: ReadonlyArray<{ readonly label: string; readonly value: string }> = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at 9am', value: '0 9 * * *' },
  { label: 'Weekly Monday', value: '0 9 * * 1' },
  { label: 'Weekdays 9am', value: '0 9 * * 1-5' },
];

function EventConfig({
  control,
  watch,
  setValue,
}: Readonly<{
  control: Control<AutomationFormValues>;
  watch: UseFormWatch<AutomationFormValues>;
  setValue: UseFormSetValue<AutomationFormValues>;
}>): ReactElement {
  const triggerConfig = watch('triggerConfig');
  const events = useMemo(
    () => ('events' in triggerConfig ? triggerConfig.events : []),
    [triggerConfig],
  );
  const conditionGroups = useMemo(
    (): ConditionGroup[] =>
      'conditionGroups' in triggerConfig && Array.isArray(triggerConfig.conditionGroups)
        ? (triggerConfig.conditionGroups as ConditionGroup[])
        : [],
    [triggerConfig],
  );

  // Convert readonly ConditionGroup[] to mutable form for setValue
  const mutableConditionGroups = useMemo(
    () => conditionGroups.map((g) => ({ conditions: [...g.conditions] })),
    [conditionGroups],
  );

  const toggleEvent = useCallback(
    (event: string): void => {
      const newEvents = events.includes(event)
        ? events.filter((e) => e !== event)
        : [...events, event];
      setValue(
        'triggerConfig',
        { events: newEvents, conditionGroups: mutableConditionGroups },
        { shouldValidate: true },
      );
    },
    [events, mutableConditionGroups, setValue],
  );

  const removeEvent = useCallback(
    (event: string): void => {
      setValue(
        'triggerConfig',
        { events: events.filter((e) => e !== event), conditionGroups: mutableConditionGroups },
        { shouldValidate: true },
      );
    },
    [events, mutableConditionGroups, setValue],
  );

  const handleConditionGroupsChange = useCallback(
    (groups: ConditionGroup[]): void => {
      const mutable = groups.map((g) => ({ conditions: [...g.conditions] }));
      setValue('triggerConfig', { events, conditionGroups: mutable }, { shouldValidate: true });
    },
    [events, setValue],
  );

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">GitHub Events</Label>
        <p className="text-muted-foreground mt-1 text-sm">
          Select which GitHub events should trigger this automation.
        </p>
      </div>

      <EventCategoryPicker selectedEvents={events} onToggle={toggleEvent} onRemove={removeEvent} />

      {events.length > 0 && (
        <ConditionBuilder
          conditionGroups={conditionGroups}
          selectedEvents={events}
          onChange={handleConditionGroupsChange}
        />
      )}

      <FormField
        control={control}
        name="triggerConfig"
        render={() => (
          <FormItem>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function CronConfig({
  control,
  watch,
  setValue,
}: Readonly<{
  control: Control<AutomationFormValues>;
  watch: UseFormWatch<AutomationFormValues>;
  setValue: UseFormSetValue<AutomationFormValues>;
}>): ReactElement {
  const triggerConfig = watch('triggerConfig');
  const schedule = 'schedule' in triggerConfig ? triggerConfig.schedule : '';
  const timezone = 'timezone' in triggerConfig ? triggerConfig.timezone : '';

  const handlePresetClick = useCallback(
    (preset: string): void => {
      setValue(
        'triggerConfig',
        { schedule: preset, timezone: timezone || undefined },
        { shouldValidate: true },
      );
    },
    [setValue, timezone],
  );

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="triggerConfig"
        render={() => (
          <FormItem>
            <FormLabel>Cron Schedule</FormLabel>
            <FormControl>
              <Input
                placeholder="0 * * * *"
                className="font-mono"
                value={schedule}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setValue(
                    'triggerConfig',
                    {
                      schedule: e.target.value,
                      timezone: timezone || undefined,
                    },
                    { shouldValidate: true },
                  );
                }}
              />
            </FormControl>
            {schedule && (
              <p className="text-muted-foreground text-sm">
                <Clock className="mr-1 inline size-3" />
                {formatCronExpression(schedule, 'Invalid expression')}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <div>
        <Label className="text-sm font-medium">Presets</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CRON_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              type="button"
              variant={schedule === preset.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetClick(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Timezone</Label>
        <Input
          placeholder="e.g. America/New_York"
          className="mt-2"
          value={timezone ?? ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setValue(
              'triggerConfig',
              {
                schedule,
                timezone: e.target.value || undefined,
              },
              { shouldValidate: true },
            );
          }}
        />
        <p className="text-muted-foreground mt-1 text-sm">
          Optional. Defaults to UTC if not specified.
        </p>
      </div>
    </div>
  );
}

function ManualConfig(): ReactElement {
  return (
    <div className="flex items-start gap-3 rounded-md border p-4">
      <Info className="text-muted-foreground mt-0.5 size-5 shrink-0" />
      <div>
        <p className="text-sm font-medium">Manual Trigger</p>
        <p className="text-muted-foreground mt-1 text-sm">
          This automation can only be triggered manually from the dashboard.
        </p>
      </div>
    </div>
  );
}

export function AutomationTriggerStep({
  control,
  watch,
  setValue,
}: AutomationTriggerStepProps): ReactElement {
  const triggerType = watch('triggerType');

  const handleTriggerTypeChange = useCallback(
    (value: string): void => {
      const newType = value as AutomationFormValues['triggerType'];
      setValue('triggerType', newType, { shouldValidate: true });

      switch (newType) {
        case 'event':
          setValue('triggerConfig', { events: [], conditionGroups: [] }, { shouldValidate: false });
          break;
        case 'cron':
          setValue(
            'triggerConfig',
            { schedule: '', timezone: undefined },
            { shouldValidate: false },
          );
          break;
        case 'manual':
          setValue('triggerConfig', {}, { shouldValidate: false });
          break;
      }
    },
    [setValue],
  );

  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name="triggerType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Trigger Type</FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={handleTriggerTypeChange}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="event" id="trigger-event" />
                  <Label htmlFor="trigger-event">Event</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cron" id="trigger-cron" />
                  <Label htmlFor="trigger-cron">Cron</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="trigger-manual" />
                  <Label htmlFor="trigger-manual">Manual</Label>
                </div>
              </RadioGroup>
            </FormControl>
            <FormDescription>Choose how this automation is triggered.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {triggerType === 'event' && (
        <EventConfig control={control} watch={watch} setValue={setValue} />
      )}
      {triggerType === 'cron' && <CronConfig control={control} watch={watch} setValue={setValue} />}
      {triggerType === 'manual' && <ManualConfig />}
    </div>
  );
}
