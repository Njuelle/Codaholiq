import { GitBranch, MessageCircle, Package, Play, Tag, User } from 'lucide-react';
import type { TriggerCondition } from '@/common/types';
import type { ReactElement } from 'react';

export interface ConditionPreset {
  readonly label: string;
  readonly icon: ReactElement;
  readonly condition: TriggerCondition;
}

export function getPresetsForEvents(selectedEvents: readonly string[]): readonly ConditionPreset[] {
  const baseEvents = new Set(selectedEvents.map((e) => e.split('.')[0]!));
  const presets: ConditionPreset[] = [];

  if (selectedEvents.some((e) => e === 'issues.labeled' || e === 'pull_request.labeled')) {
    presets.push({
      label: 'Label is…',
      icon: <Tag className="size-3" />,
      condition: { path: 'label.name', operator: 'equals', value: '' },
    });
  }

  if (baseEvents.has('push')) {
    presets.push({
      label: 'Branch is…',
      icon: <GitBranch className="size-3" />,
      condition: { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
    });
  }

  if (baseEvents.has('pull_request')) {
    presets.push({
      label: 'Target branch…',
      icon: <GitBranch className="size-3" />,
      condition: { path: 'pull_request.base.ref', operator: 'equals', value: 'main' },
    });
    presets.push({
      label: 'Not draft',
      icon: <GitBranch className="size-3" />,
      condition: { path: 'pull_request.draft', operator: 'equals', value: 'false' },
    });
    presets.push({
      label: 'Author is…',
      icon: <User className="size-3" />,
      condition: { path: 'pull_request.user.login', operator: 'equals', value: '' },
    });
  }

  if (baseEvents.has('workflow_run')) {
    presets.push({
      label: 'Workflow name…',
      icon: <Play className="size-3" />,
      condition: { path: 'workflow_run.name', operator: 'equals', value: '' },
    });
    presets.push({
      label: 'Conclusion is…',
      icon: <Play className="size-3" />,
      condition: { path: 'workflow_run.conclusion', operator: 'equals', value: 'failure' },
    });
  }

  if (baseEvents.has('issue_comment')) {
    presets.push({
      label: 'Comment author…',
      icon: <MessageCircle className="size-3" />,
      condition: { path: 'comment.user.login', operator: 'equals', value: '' },
    });
    presets.push({
      label: 'Is PR comment',
      icon: <MessageCircle className="size-3" />,
      condition: { path: 'issue.pull_request', operator: 'exists' },
    });
  }

  if (baseEvents.has('release')) {
    presets.push({
      label: 'Tag name…',
      icon: <Package className="size-3" />,
      condition: { path: 'release.tag_name', operator: 'starts_with', value: 'v' },
    });
    presets.push({
      label: 'Not prerelease',
      icon: <Package className="size-3" />,
      condition: { path: 'release.prerelease', operator: 'equals', value: 'false' },
    });
  }

  return presets;
}
