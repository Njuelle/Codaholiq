import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  GitFork,
  Zap,
  Play,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';

import type { ReactElement } from 'react';

interface SidebarProps {
  readonly collapsed: boolean;
  readonly onToggleCollapse: () => void;
}

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { label: 'Automations', icon: Zap, path: 'automations' },
  { label: 'Executions', icon: Play, path: 'executions' },
  { label: 'Cost & Usage', icon: BarChart3, path: 'analytics' },
  { label: 'Repositories', icon: GitFork, path: 'repos' },
  { label: 'Settings', icon: Settings, path: 'settings' },
] as const;

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps): ReactElement {
  const { orgId } = useParams<{ orgId: string }>();

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-14 items-center border-b',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <img
          src={collapsed ? '/codaholiq_logo_sm.png' : '/codaholiq_logo.png'}
          alt="Codaholiq"
          className={cn('object-contain', collapsed ? 'h-10 w-10' : 'h-11 max-w-full')}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={`/orgs/${orgId}/${path}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex h-10 items-center justify-center border-t text-muted-foreground hover:text-foreground"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
