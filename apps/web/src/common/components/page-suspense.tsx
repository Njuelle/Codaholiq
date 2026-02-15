import { Suspense, type ReactNode, type ReactElement } from 'react';
import { LoadingScreen } from '@/common/components/loading-screen';

interface PageSuspenseProps {
  readonly children: ReactNode;
}

export function PageSuspense({ children }: PageSuspenseProps): ReactElement {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}
