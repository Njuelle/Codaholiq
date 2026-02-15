import type { GitHubEventDefinition } from '@/modules/automations/hooks/use-github-events';
import { getPayloadPathsForEvents } from '@/modules/automations/hooks/use-github-events';

export interface VariableDefinition {
  readonly key: string;
  readonly description: string;
}

export interface VariableGroup {
  readonly label: string;
  readonly variables: readonly VariableDefinition[];
}

const COMMON_VARIABLES: readonly VariableDefinition[] = [
  { key: 'timestamp', description: 'Current UTC timestamp (ISO 8601)' },
  { key: 'automation.name', description: 'Name of this automation' },
];

const MANUAL_REPO_VARIABLES: readonly VariableDefinition[] = [
  { key: 'repo.owner', description: 'Repository owner' },
  { key: 'repo.name', description: 'Repository name' },
  { key: 'repo.full_name', description: 'Full repository name (owner/name)' },
];

const EVENT_COMMON_VARIABLES: readonly VariableDefinition[] = [
  { key: 'event.type', description: 'Event type (e.g., "pull_request")' },
  { key: 'event.action', description: 'Event action (e.g., "opened")' },
  { key: 'event.repo', description: 'Repository full name' },
];

const EVENT_ENTITY_VARIABLES: readonly VariableDefinition[] = [
  { key: 'event.title', description: 'PR or issue title' },
  { key: 'event.number', description: 'PR or issue number' },
  { key: 'event.body', description: 'PR or issue body/description' },
  { key: 'event.label', description: 'Label name (when applicable)' },
];

/**
 * Payload paths that are already covered by built-in entity variables
 * (event.title, event.number, event.body). These map to stable GitHub API
 * payload structures and are filtered out to avoid showing duplicate suggestions.
 */
const BUILT_IN_OVERLAP_PATHS: ReadonlySet<string> = new Set([
  'pull_request.title',
  'pull_request.number',
  'pull_request.body',
  'issue.title',
  'issue.number',
  'issue.body',
]);

/**
 * Extracts base event names from compound event strings.
 * e.g., "pull_request.opened" → "pull_request"
 */
function extractBaseEvents(events: readonly string[]): readonly string[] {
  const bases = new Set<string>();
  for (const eventStr of events) {
    bases.add(eventStr.split('.')[0]!);
  }
  return [...bases];
}

/**
 * Returns whether any of the selected events provide entity built-ins
 * (event.title, event.number, event.body), using the `hasEntityBuiltIns`
 * flag from the API-served event catalog.
 */
function hasEntityEvents({
  selectedEvents,
  allEvents,
}: {
  readonly selectedEvents: readonly string[];
  readonly allEvents: readonly GitHubEventDefinition[];
}): boolean {
  const bases = extractBaseEvents(selectedEvents);
  return bases.some((base) => {
    const def = allEvents.find((e) => e.event === base);
    return def?.hasEntityBuiltIns === true;
  });
}

/**
 * Computes the available variable groups based on the current trigger context.
 * Variables adapt dynamically to the selected trigger type and events.
 */
export function getAvailableVariables({
  triggerType,
  selectedEvents,
  allEvents,
  sharedVariables,
}: {
  readonly triggerType: 'event' | 'cron' | 'manual';
  readonly selectedEvents: readonly string[];
  readonly allEvents: readonly GitHubEventDefinition[];
  readonly sharedVariables?: readonly { key: string; description: string | null }[];
}): readonly VariableGroup[] {
  const groups: VariableGroup[] = [];

  // General variables — always shown
  groups.push({ label: 'General', variables: COMMON_VARIABLES });

  // Shared variables — always shown when available
  if (sharedVariables && sharedVariables.length > 0) {
    groups.push({
      label: 'Shared Variables',
      variables: sharedVariables.map((v) => ({
        key: v.key,
        description: v.description ?? 'Shared variable',
      })),
    });
  }

  if (triggerType === 'manual') {
    groups.push({ label: 'Repository', variables: MANUAL_REPO_VARIABLES });
    return groups;
  }

  if (triggerType === 'cron') {
    return groups;
  }

  // Event trigger
  groups.push({ label: 'Event Info', variables: EVENT_COMMON_VARIABLES });

  if (selectedEvents.length === 0) {
    return groups;
  }

  // Entity variables (event.title/number/body) — only for PR/issue events
  if (hasEntityEvents({ selectedEvents, allEvents })) {
    groups.push({ label: 'PR / Issue', variables: EVENT_ENTITY_VARIABLES });
  }

  // Payload path variables from the backend catalog
  const payloadPaths = getPayloadPathsForEvents({
    events: selectedEvents,
    allEvents,
  });

  const filteredPaths = payloadPaths.filter((pp) => !BUILT_IN_OVERLAP_PATHS.has(pp.path));

  if (filteredPaths.length > 0) {
    groups.push({
      label: 'Event Payload',
      variables: filteredPaths.map((pp) => ({
        key: pp.path,
        description: pp.description,
      })),
    });
  }

  return groups;
}
