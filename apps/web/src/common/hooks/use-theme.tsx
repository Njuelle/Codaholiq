import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
  type ReactElement,
} from 'react';
import { useLocalStorage } from '@/common/hooks/use-local-storage';
import { useMediaQuery } from '@/common/hooks/use-media-query';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  readonly theme: Theme;
  readonly resolvedTheme: 'light' | 'dark';
  readonly setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'codaholiq-theme';

interface ThemeProviderProps {
  readonly children: ReactNode;
  readonly defaultTheme?: Theme;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps): ReactElement {
  const [theme, setTheme] = useLocalStorage<Theme>(STORAGE_KEY, defaultTheme);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
