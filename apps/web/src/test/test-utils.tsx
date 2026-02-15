import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/common/hooks/use-theme';
import { AuthProvider } from '@/modules/auth/hooks/use-auth';
import { OrgProvider } from '@/modules/organizations/hooks/use-org';
import type { User } from '@/modules/auth/types';
import type { Organization } from '@/modules/organizations/types';
import type { ReactElement, ReactNode } from 'react';

interface WrapperOptions {
  readonly initialRoute?: string;
  readonly user?: User | null;
  readonly isAuthenticated?: boolean;
  readonly org?: Organization | null;
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  options?: WrapperOptions & Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  const {
    initialRoute = '/',
    user = null,
    isAuthenticated = !!user,
    org = null,
    ...renderOptions
  } = options ?? {};

  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider
            initialUser={user}
            initialIsAuthenticated={isAuthenticated}
            skipSessionRestore
          >
            <OrgProvider initialOrg={org}>
              <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
            </OrgProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
