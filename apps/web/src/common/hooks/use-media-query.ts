import { useSyncExternalStore, useCallback, useMemo } from 'react';

export function useMediaQuery(query: string): boolean {
  const mediaQueryList = useMemo(() => window.matchMedia(query), [query]);

  const subscribe = useCallback(
    (callback: () => void) => {
      mediaQueryList.addEventListener('change', callback);
      return () => mediaQueryList.removeEventListener('change', callback);
    },
    [mediaQueryList],
  );

  const getSnapshot = useCallback((): boolean => mediaQueryList.matches, [mediaQueryList]);

  const getServerSnapshot = (): boolean => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
