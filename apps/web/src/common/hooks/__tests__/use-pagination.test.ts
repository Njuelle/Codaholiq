import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../use-pagination';

describe('usePagination', () => {
  it('should initialize with defaults', () => {
    const { result } = renderHook(() => usePagination());

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.offset).toBe(0);
  });

  it('should use custom initial page size', () => {
    const { result } = renderHook(() => usePagination({ initialPageSize: 10 }));
    expect(result.current.pageSize).toBe(10);
  });

  it('should calculate totalPages correctly', () => {
    const { result } = renderHook(() => usePagination({ initialPageSize: 10 }));

    act(() => result.current.setTotalItems(55));
    expect(result.current.totalPages).toBe(6);
  });

  it('should calculate offset correctly', () => {
    const { result } = renderHook(() => usePagination({ initialPageSize: 10 }));

    act(() => result.current.setTotalItems(100));
    act(() => result.current.setPage(3));
    expect(result.current.offset).toBe(20);
  });

  it('should navigate pages', () => {
    const { result } = renderHook(() => usePagination({ initialPageSize: 10 }));

    act(() => result.current.setTotalItems(50));

    act(() => result.current.nextPage());
    expect(result.current.page).toBe(2);

    act(() => result.current.nextPage());
    expect(result.current.page).toBe(3);

    act(() => result.current.previousPage());
    expect(result.current.page).toBe(2);
  });

  it('should not go below page 1', () => {
    const { result } = renderHook(() => usePagination());

    act(() => result.current.previousPage());
    expect(result.current.page).toBe(1);
  });

  it('should not go above total pages', () => {
    const { result } = renderHook(() => usePagination({ initialPageSize: 10 }));

    act(() => result.current.setTotalItems(20));
    act(() => result.current.setPage(2));
    act(() => result.current.nextPage());
    expect(result.current.page).toBe(2);
  });

  it('should report hasNextPage and hasPreviousPage', () => {
    const { result } = renderHook(() => usePagination({ initialPageSize: 10 }));

    act(() => result.current.setTotalItems(30));

    expect(result.current.hasPreviousPage).toBe(false);
    expect(result.current.hasNextPage).toBe(true);

    act(() => result.current.setPage(3));
    expect(result.current.hasPreviousPage).toBe(true);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('should reset page to 1 when page size changes', () => {
    const { result } = renderHook(() => usePagination({ initialPageSize: 10 }));

    act(() => result.current.setTotalItems(100));
    act(() => result.current.setPage(5));
    act(() => result.current.setPageSize(20));

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);
  });
});
