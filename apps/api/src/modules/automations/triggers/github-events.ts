export type GitHubEventCategory =
  | 'code_and_commits'
  | 'pull_requests'
  | 'issues'
  | 'ci_cd'
  | 'releases'
  | 'security'
  | 'repositories'
  | 'discussions'
  | 'projects';

export interface GitHubEventAction {
  readonly name: string;
  readonly description: string;
}

export interface GitHubEventPayloadPath {
  readonly path: string;
  readonly description: string;
}

export interface GitHubEventDefinition {
  readonly event: string;
  readonly description: string;
  readonly category: GitHubEventCategory;
  readonly actions: readonly GitHubEventAction[];
  readonly conclusions?: readonly string[];
  readonly payloadPaths?: readonly GitHubEventPayloadPath[];
  readonly hasEntityBuiltIns?: boolean;
}

export const GITHUB_EVENT_CATEGORIES: ReadonlyArray<{
  readonly id: GitHubEventCategory;
  readonly label: string;
}> = [
  { id: 'code_and_commits', label: 'Code & Commits' },
  { id: 'pull_requests', label: 'Pull Requests' },
  { id: 'issues', label: 'Issues' },
  { id: 'ci_cd', label: 'CI / CD' },
  { id: 'releases', label: 'Releases' },
  { id: 'security', label: 'Security' },
  { id: 'repositories', label: 'Repositories' },
  { id: 'discussions', label: 'Discussions' },
  { id: 'projects', label: 'Projects' },
];

export const GITHUB_EVENTS_CATALOG: readonly GitHubEventDefinition[] = [
  // ── Code & Commits ──────────────────────────────────────────────
  {
    event: 'push',
    description: 'One or more commits pushed to a branch or tag',
    category: 'code_and_commits',
    actions: [],
    payloadPaths: [
      { path: 'ref', description: 'Branch or tag ref (e.g. refs/heads/main)' },
      { path: 'pusher.name', description: 'Username of the pusher' },
      { path: 'head_commit.message', description: 'Head commit message' },
      { path: 'forced', description: 'Whether this was a force push' },
    ],
  },
  {
    event: 'create',
    description: 'Branch or tag created',
    category: 'code_and_commits',
    actions: [],
    payloadPaths: [
      { path: 'ref', description: 'Branch or tag name' },
      { path: 'ref_type', description: 'Type of ref (branch or tag)' },
    ],
  },
  {
    event: 'delete',
    description: 'Branch or tag deleted',
    category: 'code_and_commits',
    actions: [],
    payloadPaths: [
      { path: 'ref', description: 'Branch or tag name' },
      { path: 'ref_type', description: 'Type of ref (branch or tag)' },
    ],
  },
  {
    event: 'commit_comment',
    description: 'Comment on a commit',
    category: 'code_and_commits',
    actions: [{ name: 'created', description: 'Comment created' }],
    payloadPaths: [
      { path: 'comment.body', description: 'Comment text' },
      { path: 'comment.user.login', description: 'Comment author username' },
      { path: 'comment.path', description: 'File path the comment is on' },
      { path: 'comment.position', description: 'Line position of the comment' },
    ],
  },
  {
    event: 'gollum',
    description: 'Wiki page created or updated',
    category: 'code_and_commits',
    actions: [],
    payloadPaths: [
      { path: 'pages[].page_name', description: 'Wiki page name' },
      { path: 'pages[].action', description: 'Action performed (created or edited)' },
    ],
  },

  // ── Pull Requests ───────────────────────────────────────────────
  {
    event: 'pull_request',
    description: 'Pull request activity',
    category: 'pull_requests',
    hasEntityBuiltIns: true,
    payloadPaths: [
      { path: 'pull_request.base.ref', description: 'Target branch name' },
      { path: 'pull_request.head.ref', description: 'Source branch name' },
      { path: 'pull_request.title', description: 'PR title' },
      { path: 'pull_request.draft', description: 'Whether PR is a draft' },
      { path: 'pull_request.user.login', description: 'PR author username' },
      { path: 'pull_request.labels', description: 'PR labels (array)' },
      { path: 'label.name', description: 'Label that triggered the event' },
    ],
    actions: [
      { name: 'opened', description: 'Pull request opened' },
      { name: 'closed', description: 'Pull request closed' },
      { name: 'merged', description: 'Pull request merged' },
      { name: 'reopened', description: 'Pull request reopened' },
      { name: 'synchronize', description: 'New commits pushed to PR' },
      { name: 'edited', description: 'PR title or body edited' },
      { name: 'assigned', description: 'User assigned to PR' },
      { name: 'unassigned', description: 'User unassigned from PR' },
      { name: 'labeled', description: 'Label added to PR' },
      { name: 'unlabeled', description: 'Label removed from PR' },
      { name: 'review_requested', description: 'Review requested on PR' },
      {
        name: 'review_request_removed',
        description: 'Review request removed',
      },
      {
        name: 'ready_for_review',
        description: 'PR marked ready for review',
      },
      {
        name: 'converted_to_draft',
        description: 'PR converted to draft',
      },
      { name: 'locked', description: 'PR conversation locked' },
      { name: 'unlocked', description: 'PR conversation unlocked' },
      {
        name: 'auto_merge_enabled',
        description: 'Auto-merge enabled on PR',
      },
      {
        name: 'auto_merge_disabled',
        description: 'Auto-merge disabled on PR',
      },
      { name: 'enqueued', description: 'PR added to merge queue' },
      { name: 'dequeued', description: 'PR removed from merge queue' },
    ],
  },
  {
    event: 'pull_request_review',
    description: 'Pull request review activity',
    category: 'pull_requests',
    hasEntityBuiltIns: true,
    actions: [
      { name: 'submitted', description: 'Review submitted' },
      { name: 'edited', description: 'Review body edited' },
      { name: 'dismissed', description: 'Review dismissed' },
    ],
    payloadPaths: [
      {
        path: 'review.state',
        description: 'Review state (approved, changes_requested, commented)',
      },
      { path: 'review.body', description: 'Review body text' },
      { path: 'review.user.login', description: 'Reviewer username' },
      { path: 'pull_request.title', description: 'PR title' },
      { path: 'pull_request.number', description: 'PR number' },
    ],
  },
  {
    event: 'pull_request_review_comment',
    description: 'Comment on a pull request diff',
    category: 'pull_requests',
    hasEntityBuiltIns: true,
    actions: [
      { name: 'created', description: 'Comment created' },
      { name: 'edited', description: 'Comment edited' },
      { name: 'deleted', description: 'Comment deleted' },
    ],
    payloadPaths: [
      { path: 'comment.body', description: 'Comment text' },
      { path: 'comment.user.login', description: 'Comment author username' },
      { path: 'comment.path', description: 'File path the comment is on' },
      { path: 'comment.line', description: 'Line number of the comment' },
      { path: 'pull_request.title', description: 'PR title' },
      { path: 'pull_request.number', description: 'PR number' },
    ],
  },
  {
    event: 'pull_request_review_thread',
    description: 'Pull request review thread resolved or unresolved',
    category: 'pull_requests',
    hasEntityBuiltIns: true,
    actions: [
      { name: 'resolved', description: 'Thread resolved' },
      { name: 'unresolved', description: 'Thread unresolved' },
    ],
    payloadPaths: [
      { path: 'pull_request.title', description: 'PR title' },
      { path: 'pull_request.number', description: 'PR number' },
    ],
  },
  {
    event: 'merge_group',
    description: 'Merge queue activity',
    category: 'pull_requests',
    actions: [
      {
        name: 'checks_requested',
        description: 'Merge group checks requested',
      },
      { name: 'destroyed', description: 'Merge group destroyed' },
    ],
    payloadPaths: [
      { path: 'merge_group.head_ref', description: 'Head ref of the merge group' },
      { path: 'merge_group.base_ref', description: 'Base ref of the merge group' },
    ],
  },

  // ── Issues ──────────────────────────────────────────────────────
  {
    event: 'issues',
    description: 'Issue activity',
    category: 'issues',
    hasEntityBuiltIns: true,
    payloadPaths: [
      { path: 'issue.title', description: 'Issue title' },
      { path: 'issue.state', description: 'Issue state (open/closed)' },
      { path: 'issue.user.login', description: 'Issue author username' },
      { path: 'issue.labels', description: 'Issue labels (array)' },
      { path: 'label.name', description: 'Label that triggered the event' },
    ],
    actions: [
      { name: 'opened', description: 'Issue opened' },
      { name: 'closed', description: 'Issue closed' },
      { name: 'reopened', description: 'Issue reopened' },
      { name: 'edited', description: 'Issue title or body edited' },
      { name: 'assigned', description: 'User assigned to issue' },
      { name: 'unassigned', description: 'User unassigned from issue' },
      { name: 'labeled', description: 'Label added to issue' },
      { name: 'unlabeled', description: 'Label removed from issue' },
      { name: 'milestoned', description: 'Issue added to milestone' },
      {
        name: 'demilestoned',
        description: 'Issue removed from milestone',
      },
      { name: 'transferred', description: 'Issue transferred' },
      { name: 'pinned', description: 'Issue pinned' },
      { name: 'unpinned', description: 'Issue unpinned' },
      { name: 'locked', description: 'Issue conversation locked' },
      { name: 'unlocked', description: 'Issue conversation unlocked' },
      { name: 'deleted', description: 'Issue deleted' },
    ],
  },
  {
    event: 'issue_comment',
    description: 'Comment on an issue or pull request',
    category: 'issues',
    hasEntityBuiltIns: true,
    payloadPaths: [
      { path: 'comment.body', description: 'Comment text' },
      { path: 'comment.user.login', description: 'Comment author username' },
      { path: 'issue.pull_request', description: 'PR info (exists if PR comment)' },
      { path: 'issue.title', description: 'Issue or PR title' },
    ],
    actions: [
      { name: 'created', description: 'Comment created' },
      { name: 'edited', description: 'Comment edited' },
      { name: 'deleted', description: 'Comment deleted' },
    ],
  },
  {
    event: 'label',
    description: 'Label created, edited, or deleted',
    category: 'issues',
    actions: [
      { name: 'created', description: 'Label created' },
      { name: 'edited', description: 'Label edited' },
      { name: 'deleted', description: 'Label deleted' },
    ],
    payloadPaths: [
      { path: 'label.name', description: 'Label name' },
      { path: 'label.color', description: 'Label color hex code' },
      { path: 'label.description', description: 'Label description' },
    ],
  },
  {
    event: 'milestone',
    description: 'Milestone created, closed, opened, edited, or deleted',
    category: 'issues',
    actions: [
      { name: 'created', description: 'Milestone created' },
      { name: 'closed', description: 'Milestone closed' },
      { name: 'opened', description: 'Milestone opened' },
      { name: 'edited', description: 'Milestone edited' },
      { name: 'deleted', description: 'Milestone deleted' },
    ],
    payloadPaths: [
      { path: 'milestone.title', description: 'Milestone title' },
      { path: 'milestone.state', description: 'Milestone state (open/closed)' },
      { path: 'milestone.description', description: 'Milestone description' },
    ],
  },

  // ── CI / CD ─────────────────────────────────────────────────────
  {
    event: 'workflow_run',
    description: 'GitHub Actions workflow run',
    category: 'ci_cd',
    payloadPaths: [
      { path: 'workflow_run.name', description: 'Workflow name' },
      { path: 'workflow_run.head_branch', description: 'Branch that triggered the run' },
      { path: 'workflow_run.conclusion', description: 'Run conclusion (success, failure, etc.)' },
      { path: 'workflow_run.event', description: 'Event that triggered the workflow' },
    ],
    actions: [
      { name: 'completed', description: 'Workflow run completed' },
      { name: 'requested', description: 'Workflow run requested' },
      { name: 'in_progress', description: 'Workflow run in progress' },
    ],
    conclusions: ['success', 'failure', 'cancelled', 'timed_out', 'skipped'],
  },
  {
    event: 'workflow_job',
    description: 'GitHub Actions workflow job',
    category: 'ci_cd',
    actions: [
      { name: 'queued', description: 'Job queued' },
      { name: 'in_progress', description: 'Job in progress' },
      { name: 'completed', description: 'Job completed' },
      { name: 'waiting', description: 'Job waiting for approval' },
    ],
    conclusions: ['success', 'failure', 'cancelled', 'timed_out', 'skipped'],
    payloadPaths: [
      { path: 'workflow_job.name', description: 'Job name' },
      { path: 'workflow_job.conclusion', description: 'Job conclusion (success, failure, etc.)' },
      { path: 'workflow_job.head_branch', description: 'Branch that triggered the job' },
      { path: 'workflow_job.runner_name', description: 'Runner that executed the job' },
    ],
  },
  {
    event: 'check_run',
    description: 'Check run activity',
    category: 'ci_cd',
    actions: [
      { name: 'created', description: 'Check run created' },
      { name: 'completed', description: 'Check run completed' },
      { name: 'rerequested', description: 'Check run re-requested' },
      {
        name: 'requested_action',
        description: 'Action requested from check run',
      },
    ],
    conclusions: [
      'success',
      'failure',
      'neutral',
      'cancelled',
      'timed_out',
      'action_required',
      'skipped',
    ],
    payloadPaths: [
      { path: 'check_run.name', description: 'Check run name' },
      { path: 'check_run.conclusion', description: 'Check run conclusion' },
      { path: 'check_run.head_sha', description: 'Head commit SHA' },
    ],
  },
  {
    event: 'check_suite',
    description: 'Check suite activity',
    category: 'ci_cd',
    actions: [
      { name: 'completed', description: 'Check suite completed' },
      { name: 'requested', description: 'Check suite requested' },
      { name: 'rerequested', description: 'Check suite re-requested' },
    ],
    conclusions: [
      'success',
      'failure',
      'neutral',
      'cancelled',
      'timed_out',
      'action_required',
      'skipped',
      'stale',
    ],
    payloadPaths: [
      { path: 'check_suite.conclusion', description: 'Check suite conclusion' },
      { path: 'check_suite.head_branch', description: 'Branch that triggered the suite' },
      { path: 'check_suite.head_sha', description: 'Head commit SHA' },
    ],
  },
  {
    event: 'deployment',
    description: 'Deployment created',
    category: 'ci_cd',
    actions: [{ name: 'created', description: 'Deployment created' }],
    payloadPaths: [
      { path: 'deployment.environment', description: 'Deployment environment name' },
      { path: 'deployment.ref', description: 'Deployment ref (branch/tag/SHA)' },
      { path: 'deployment.description', description: 'Deployment description' },
    ],
  },
  {
    event: 'deployment_status',
    description: 'Deployment status changed',
    category: 'ci_cd',
    actions: [{ name: 'created', description: 'Deployment status created' }],
    payloadPaths: [
      {
        path: 'deployment_status.state',
        description: 'Deployment status (success, failure, error, etc.)',
      },
      { path: 'deployment_status.environment', description: 'Deployment environment name' },
      { path: 'deployment.ref', description: 'Deployment ref (branch/tag/SHA)' },
    ],
  },
  {
    event: 'deployment_protection_rule',
    description: 'Deployment protection rule requested',
    category: 'ci_cd',
    actions: [
      {
        name: 'requested',
        description: 'Deployment protection rule requested',
      },
    ],
    payloadPaths: [{ path: 'environment', description: 'Deployment environment name' }],
  },
  {
    event: 'status',
    description: 'Commit status updated',
    category: 'ci_cd',
    actions: [],
    payloadPaths: [
      { path: 'state', description: 'Commit status state (pending, success, failure, error)' },
      { path: 'context', description: 'Status context (e.g., CI service name)' },
      { path: 'sha', description: 'Commit SHA' },
      { path: 'target_url', description: 'URL with status details' },
    ],
  },

  // ── Releases ────────────────────────────────────────────────────
  {
    event: 'release',
    description: 'Release activity',
    category: 'releases',
    payloadPaths: [
      { path: 'release.tag_name', description: 'Release tag name' },
      { path: 'release.prerelease', description: 'Whether this is a pre-release' },
      { path: 'release.draft', description: 'Whether this is a draft release' },
      { path: 'release.name', description: 'Release title' },
    ],
    actions: [
      { name: 'published', description: 'Release published' },
      { name: 'unpublished', description: 'Release unpublished' },
      { name: 'created', description: 'Release created' },
      { name: 'edited', description: 'Release edited' },
      { name: 'deleted', description: 'Release deleted' },
      { name: 'prereleased', description: 'Pre-release published' },
      { name: 'released', description: 'Release finalized' },
    ],
  },
  {
    event: 'package',
    description: 'GitHub Package activity',
    category: 'releases',
    actions: [
      { name: 'published', description: 'Package published' },
      { name: 'updated', description: 'Package updated' },
    ],
    payloadPaths: [
      { path: 'package.name', description: 'Package name' },
      { path: 'package.package_type', description: 'Package type (npm, docker, etc.)' },
    ],
  },
  {
    event: 'registry_package',
    description: 'Registry package activity',
    category: 'releases',
    actions: [
      { name: 'published', description: 'Registry package published' },
      { name: 'updated', description: 'Registry package updated' },
    ],
    payloadPaths: [
      { path: 'registry_package.name', description: 'Package name' },
      { path: 'registry_package.package_type', description: 'Package type' },
    ],
  },

  // ── Security ────────────────────────────────────────────────────
  {
    event: 'code_scanning_alert',
    description: 'Code scanning alert activity',
    category: 'security',
    actions: [
      { name: 'created', description: 'Alert created' },
      { name: 'reopened', description: 'Alert reopened' },
      {
        name: 'reopened_by_user',
        description: 'Alert reopened by user',
      },
      { name: 'closed_by_user', description: 'Alert closed by user' },
      { name: 'fixed', description: 'Alert fixed' },
      {
        name: 'appeared_in_branch',
        description: 'Alert appeared in branch',
      },
    ],
    payloadPaths: [
      { path: 'alert.rule.id', description: 'Scanning rule ID' },
      { path: 'alert.rule.description', description: 'Scanning rule description' },
      { path: 'alert.rule.severity', description: 'Alert severity (warning, error, etc.)' },
      { path: 'alert.tool.name', description: 'Scanning tool name' },
    ],
  },
  {
    event: 'dependabot_alert',
    description: 'Dependabot alert activity',
    category: 'security',
    actions: [
      { name: 'created', description: 'Alert created' },
      { name: 'dismissed', description: 'Alert dismissed' },
      { name: 'fixed', description: 'Alert fixed' },
      {
        name: 'reintroduced',
        description: 'Alert reintroduced',
      },
      { name: 'auto_dismissed', description: 'Alert auto-dismissed' },
      { name: 'auto_reopened', description: 'Alert auto-reopened' },
    ],
    payloadPaths: [
      { path: 'alert.security_advisory.summary', description: 'Advisory summary' },
      { path: 'alert.dependency.package.name', description: 'Vulnerable package name' },
      { path: 'alert.severity', description: 'Alert severity (low, medium, high, critical)' },
    ],
  },
  {
    event: 'secret_scanning_alert',
    description: 'Secret scanning alert activity',
    category: 'security',
    actions: [
      { name: 'created', description: 'Alert created' },
      { name: 'resolved', description: 'Alert resolved' },
      { name: 'reopened', description: 'Alert reopened' },
      { name: 'validated', description: 'Alert validated' },
    ],
    payloadPaths: [
      { path: 'alert.secret_type', description: 'Type of secret detected' },
      { path: 'alert.resolution', description: 'Alert resolution (false_positive, revoked, etc.)' },
    ],
  },
  {
    event: 'repository_vulnerability_alert',
    description: 'Repository vulnerability alert',
    category: 'security',
    actions: [
      { name: 'create', description: 'Vulnerability alert created' },
      {
        name: 'dismiss',
        description: 'Vulnerability alert dismissed',
      },
      {
        name: 'resolve',
        description: 'Vulnerability alert resolved',
      },
    ],
    payloadPaths: [{ path: 'alert.affected_package_name', description: 'Affected package name' }],
  },
  {
    event: 'branch_protection_rule',
    description: 'Branch protection rule activity',
    category: 'security',
    actions: [
      { name: 'created', description: 'Rule created' },
      { name: 'edited', description: 'Rule edited' },
      { name: 'deleted', description: 'Rule deleted' },
    ],
    payloadPaths: [{ path: 'rule.name', description: 'Branch protection rule name' }],
  },
  {
    event: 'branch_protection_configuration',
    description: 'Branch protection enforcement changes',
    category: 'security',
    actions: [
      { name: 'disabled', description: 'Enforcement disabled' },
      { name: 'enabled', description: 'Enforcement enabled' },
    ],
    payloadPaths: [{ path: 'rule.name', description: 'Branch protection rule name' }],
  },

  // ── Repositories ────────────────────────────────────────────────
  {
    event: 'repository',
    description: 'Repository activity',
    category: 'repositories',
    actions: [
      { name: 'created', description: 'Repository created' },
      { name: 'deleted', description: 'Repository deleted' },
      { name: 'archived', description: 'Repository archived' },
      { name: 'unarchived', description: 'Repository unarchived' },
      { name: 'edited', description: 'Repository settings edited' },
      { name: 'renamed', description: 'Repository renamed' },
      { name: 'transferred', description: 'Repository transferred' },
      {
        name: 'publicized',
        description: 'Repository made public',
      },
      {
        name: 'privatized',
        description: 'Repository made private',
      },
    ],
    payloadPaths: [
      { path: 'repository.name', description: 'Repository name' },
      { path: 'repository.full_name', description: 'Full repository name (owner/name)' },
      { path: 'repository.default_branch', description: 'Default branch name' },
      { path: 'repository.private', description: 'Whether the repository is private' },
    ],
  },
  {
    event: 'star',
    description: 'Repository starred or unstarred',
    category: 'repositories',
    actions: [
      { name: 'created', description: 'Repository starred' },
      { name: 'deleted', description: 'Star removed' },
    ],
    payloadPaths: [{ path: 'sender.login', description: 'User who starred/unstarred' }],
  },
  {
    event: 'fork',
    description: 'Repository forked',
    category: 'repositories',
    actions: [],
    payloadPaths: [
      { path: 'forkee.full_name', description: 'Full name of the forked repository' },
      { path: 'forkee.owner.login', description: 'Owner of the forked repository' },
    ],
  },
  {
    event: 'watch',
    description: 'User started watching repository',
    category: 'repositories',
    actions: [{ name: 'started', description: 'Started watching' }],
    payloadPaths: [{ path: 'sender.login', description: 'User who started watching' }],
  },
  {
    event: 'member',
    description: 'Collaborator activity',
    category: 'repositories',
    actions: [
      { name: 'added', description: 'Collaborator added' },
      { name: 'removed', description: 'Collaborator removed' },
      { name: 'edited', description: 'Collaborator permissions edited' },
    ],
    payloadPaths: [{ path: 'member.login', description: 'Collaborator username' }],
  },
  {
    event: 'public',
    description: 'Repository made public',
    category: 'repositories',
    actions: [],
  },
  {
    event: 'page_build',
    description: 'GitHub Pages build',
    category: 'repositories',
    actions: [],
    payloadPaths: [
      { path: 'build.status', description: 'Build status (built, errored, etc.)' },
      { path: 'build.error.message', description: 'Build error message (if failed)' },
    ],
  },
  {
    event: 'ping',
    description: 'Webhook ping event',
    category: 'repositories',
    actions: [],
  },

  // ── Discussions ─────────────────────────────────────────────────
  {
    event: 'discussion',
    description: 'Discussion activity',
    category: 'discussions',
    actions: [
      { name: 'created', description: 'Discussion created' },
      { name: 'edited', description: 'Discussion edited' },
      { name: 'deleted', description: 'Discussion deleted' },
      { name: 'pinned', description: 'Discussion pinned' },
      { name: 'unpinned', description: 'Discussion unpinned' },
      { name: 'locked', description: 'Discussion locked' },
      { name: 'unlocked', description: 'Discussion unlocked' },
      { name: 'transferred', description: 'Discussion transferred' },
      {
        name: 'category_changed',
        description: 'Discussion category changed',
      },
      { name: 'answered', description: 'Discussion answered' },
      { name: 'unanswered', description: 'Discussion unanswered' },
      { name: 'labeled', description: 'Label added to discussion' },
      {
        name: 'unlabeled',
        description: 'Label removed from discussion',
      },
    ],
    payloadPaths: [
      { path: 'discussion.title', description: 'Discussion title' },
      { path: 'discussion.body', description: 'Discussion body text' },
      { path: 'discussion.user.login', description: 'Discussion author username' },
      { path: 'discussion.category.name', description: 'Discussion category name' },
    ],
  },
  {
    event: 'discussion_comment',
    description: 'Discussion comment activity',
    category: 'discussions',
    actions: [
      { name: 'created', description: 'Comment created' },
      { name: 'edited', description: 'Comment edited' },
      { name: 'deleted', description: 'Comment deleted' },
    ],
    payloadPaths: [
      { path: 'comment.body', description: 'Comment text' },
      { path: 'comment.user.login', description: 'Comment author username' },
      { path: 'discussion.title', description: 'Discussion title' },
    ],
  },

  // ── Projects ────────────────────────────────────────────────────
  {
    event: 'projects_v2_item',
    description: 'Project (V2) item activity',
    category: 'projects',
    actions: [
      { name: 'created', description: 'Item added to project' },
      { name: 'edited', description: 'Item field value changed' },
      { name: 'deleted', description: 'Item removed from project' },
      { name: 'archived', description: 'Item archived' },
      { name: 'restored', description: 'Item restored' },
      { name: 'reordered', description: 'Item reordered' },
      {
        name: 'converted',
        description: 'Draft item converted to issue',
      },
    ],
    payloadPaths: [
      {
        path: 'projects_v2_item.content_type',
        description: 'Item content type (Issue, PullRequest, DraftIssue)',
      },
    ],
  },
  {
    event: 'projects_v2',
    description: 'Project (V2) activity',
    category: 'projects',
    actions: [
      { name: 'created', description: 'Project created' },
      { name: 'edited', description: 'Project edited' },
      { name: 'deleted', description: 'Project deleted' },
      { name: 'closed', description: 'Project closed' },
      { name: 'reopened', description: 'Project reopened' },
    ],
    payloadPaths: [{ path: 'projects_v2.title', description: 'Project title' }],
  },
];

/**
 * Build a Set of all valid event strings from the catalog.
 * For events with no actions: just the event name (e.g., "push").
 * For events with actions: "event.action" (e.g., "pull_request.opened").
 * For events with conclusions: "event.action.conclusion" (e.g., "workflow_run.completed.failure").
 */
export function buildValidEventStrings(
  catalog: readonly GitHubEventDefinition[],
): ReadonlySet<string> {
  const events = new Set<string>();

  for (const def of catalog) {
    if (def.actions.length === 0) {
      // Events without actions (e.g., "push", "fork")
      events.add(def.event);
    } else {
      for (const action of def.actions) {
        // Base compound: "event.action"
        events.add(`${def.event}.${action.name}`);
      }
    }

    // Conclusion-based compounds: "event.action.conclusion"
    if (def.conclusions) {
      for (const action of def.actions) {
        for (const conclusion of def.conclusions) {
          events.add(`${def.event}.${action.name}.${conclusion}`);
        }
      }
    }
  }

  return events;
}
