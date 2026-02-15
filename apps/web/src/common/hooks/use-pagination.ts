import { useState, useMemo, useCallback } from 'react';

interface PaginationState {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly offset: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly setPage: (page: number) => void;
  readonly setPageSize: (size: number) => void;
  readonly setTotalItems: (total: number) => void;
  readonly nextPage: () => void;
  readonly previousPage: () => void;
}

export function usePagination({
  initialPageSize = 20,
}: { initialPageSize?: number } = {}): PaginationState {
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / pageSize)),
    [totalItems, pageSize],
  );

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const setPage = useCallback(
    (newPage: number) => {
      setPageRaw(Math.max(1, Math.min(newPage, totalPages)));
    },
    [totalPages],
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  }, []);

  const nextPage = useCallback(() => {
    if (hasNextPage) setPageRaw((p) => p + 1);
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) setPageRaw((p) => p - 1);
  }, [hasPreviousPage]);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    offset,
    hasNextPage,
    hasPreviousPage,
    setPage,
    setPageSize,
    setTotalItems,
    nextPage,
    previousPage,
  };
}
