import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/common/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/common/components/ui/popover';
import { useNotifications } from '@/modules/notifications/hooks/use-notifications';
import { useDismissNotification } from '@/modules/notifications/hooks/use-dismiss-notification';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import type { Notification } from '@/common/types';
import type { ReactElement } from 'react';

export function NotificationBell(): ReactElement {
  const { org } = useOrg();
  const orgId = org?.id ?? 0;
  const { notifications, count } = useNotifications({ orgId });
  const dismissMutation = useDismissNotification({ orgId });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: Notification): void => {
    dismissMutation.mutate(notification.id);
    setOpen(false);
    void navigate(`/orgs/${orgId}/executions/${notification.executionId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
        </div>
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto" role="list">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-muted border-b last:border-0"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <p className="text-sm font-medium truncate">{notification.automationName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
