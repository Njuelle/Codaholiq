import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/common/components/ui/accordion';
import { Badge } from '@/common/components/ui/badge';
import { Checkbox } from '@/common/components/ui/checkbox';
import { Input } from '@/common/components/ui/input';
import { Label } from '@/common/components/ui/label';
import { Skeleton } from '@/common/components/ui/skeleton';
import {
  useGitHubEvents,
  type GitHubEventDefinition,
} from '@/modules/automations/hooks/use-github-events';
import { X } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';

interface EventCategoryPickerProps {
  readonly selectedEvents: readonly string[];
  readonly onToggle: (event: string) => void;
  readonly onRemove: (event: string) => void;
}

export function EventCategoryPicker({
  selectedEvents,
  onToggle,
  onRemove,
}: EventCategoryPickerProps): ReactElement {
  const { categories, events, isLoading } = useGitHubEvents();
  const [search, setSearch] = useState('');

  const selectedSet = useMemo(() => new Set(selectedEvents), [selectedEvents]);

  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events;
    const lower = search.toLowerCase();
    return events.filter(
      (e) =>
        e.event.toLowerCase().includes(lower) ||
        e.description.toLowerCase().includes(lower) ||
        e.actions.some((a) => a.name.toLowerCase().includes(lower)),
    );
  }, [events, search]);

  const eventsByCategory = useMemo(() => {
    const map = new Map<string, GitHubEventDefinition[]>();
    for (const event of filteredEvents) {
      const existing = map.get(event.category);
      if (existing) {
        existing.push(event);
      } else {
        map.set(event.category, [event]);
      }
    }
    return map;
  }, [filteredEvents]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearch(e.target.value);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input placeholder="Search events..." value={search} onChange={handleSearchChange} />

      {selectedEvents.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Selected ({selectedEvents.length})</Label>
          <div className="flex flex-wrap gap-2">
            {selectedEvents.map((event) => (
              <Badge key={event} variant="secondary" className="gap-1 pr-1">
                {event}
                <button
                  type="button"
                  onClick={() => onRemove(event)}
                  className="hover:bg-muted ml-1 rounded-full p-0.5"
                  aria-label={`Remove ${event}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Accordion type="multiple" className="w-full">
        {categories
          .filter((cat) => eventsByCategory.has(cat.id))
          .map((category) => (
            <AccordionItem key={category.id} value={category.id}>
              <AccordionTrigger className="text-sm font-medium">
                {category.label}
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  ({eventsByCategory.get(category.id)?.length ?? 0})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-1">
                  {eventsByCategory.get(category.id)?.map((eventDef) => (
                    <EventItem
                      key={eventDef.event}
                      eventDef={eventDef}
                      selectedSet={selectedSet}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
      </Accordion>

      {filteredEvents.length === 0 && (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No events match your search.
        </p>
      )}
    </div>
  );
}

function EventItem({
  eventDef,
  selectedSet,
  onToggle,
}: Readonly<{
  eventDef: GitHubEventDefinition;
  selectedSet: ReadonlySet<string>;
  onToggle: (event: string) => void;
}>): ReactElement {
  const hasActions = eventDef.actions.length > 0;

  if (!hasActions) {
    const isSelected = selectedSet.has(eventDef.event);
    return (
      <div className="flex items-start gap-3">
        <Checkbox
          id={`event-${eventDef.event}`}
          checked={isSelected}
          onCheckedChange={() => onToggle(eventDef.event)}
        />
        <div className="grid gap-0.5 leading-none">
          <Label htmlFor={`event-${eventDef.event}`} className="font-mono text-sm">
            {eventDef.event}
          </Label>
          <p className="text-muted-foreground text-xs">{eventDef.description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-0.5">
        <span className="font-mono text-sm font-medium">{eventDef.event}</span>
        <p className="text-muted-foreground text-xs">{eventDef.description}</p>
      </div>
      <div className="grid gap-2 pl-4">
        {eventDef.actions.map((action) => {
          const eventString = `${eventDef.event}.${action.name}`;
          const isSelected = selectedSet.has(eventString);
          return (
            <div key={action.name} className="flex items-start gap-3">
              <Checkbox
                id={`event-${eventString}`}
                checked={isSelected}
                onCheckedChange={() => onToggle(eventString)}
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor={`event-${eventString}`} className="font-mono text-xs">
                  .{action.name}
                </Label>
                <p className="text-muted-foreground text-xs">{action.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
