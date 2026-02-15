import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/common/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/common/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/common/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import { NotificationBell } from '@/modules/notifications/components/notification-bell';
import { ThemeToggle } from '@/common/components/theme-toggle';
import { useAuth } from '@/modules/auth/hooks/use-auth';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import type { ReactElement } from 'react';

export function TopBar(): ReactElement {
  const { user, logout } = useAuth();
  const { org, orgs, switchOrg } = useOrg();
  const navigate = useNavigate();

  const handleOrgSwitch = (orgId: string): void => {
    const id = Number(orgId);
    switchOrg(id);
    void navigate(`/orgs/${id}/dashboard`);
  };

  const handleLogout = (): void => {
    void logout().then(
      () => navigate('/login'),
      () => navigate('/login'),
    );
  };

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
      {/* Org switcher */}
      {org && (
        <Select value={String(org.id)} onValueChange={handleOrgSwitch}>
          <SelectTrigger className="w-48" aria-label="Switch organization">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex-1" />

      {/* Notifications */}
      <NotificationBell />

      {/* Theme toggle */}
      <ThemeToggle />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="User menu">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback>{user?.username?.charAt(0).toUpperCase() ?? '?'}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5 text-sm font-medium">{user?.username}</div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
