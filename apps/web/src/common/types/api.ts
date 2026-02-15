/** Wrapper applied by TransformInterceptor on all non-null API responses */
export interface ApiResponse<T> {
  readonly data: T;
  readonly requestId: string;
}

/** Error response shape from HttpExceptionFilter */
export interface ApiErrorResponse {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
  readonly details?: unknown;
}

/** Pagination metadata returned by list endpoints */
export interface PaginationMeta {
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Standard paginated response from list endpoints */
export interface PaginatedResponse<T> {
  readonly items: readonly T[];
  readonly meta: PaginationMeta;
}
