import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/common/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/common/components/ui/dropdown-menu';
import { useTheme, type Theme } from '@/common/hooks/use-theme';
import type { ReactElement } from 'react';

const THEME_OPTIONS: ReadonlyArray<{
  readonly value: Theme;
  readonly label: string;
  readonly icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function isTheme(value: string): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeToggle(): ReactElement {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const ActiveIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <ActiveIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value: string) => {
            if (isTheme(value)) {
              setTheme(value);
            }
          }}
        >
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
