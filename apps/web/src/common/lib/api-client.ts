import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse, ApiResponse } from '@/common/types/api';

// ---------------------------------------------------------------------------
// Token management (module-scoped, not exported directly)
// ---------------------------------------------------------------------------
let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setOnAuthFailure(callback: (() => void) | null): void {
  onAuthFailure = callback;
}

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function toApiError(error: AxiosError<ApiErrorResponse>): ApiError {
  const data = error.response?.data;
  return new ApiError(
    data?.statusCode ?? error.response?.status ?? 500,
    data?.message ?? error.message,
    data?.details,
  );
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
  withCredentials: true,
});

// Request interceptor: attach Bearer token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: unwrap TransformInterceptor envelope + handle 401
api.interceptors.response.use(
  (response) => {
    // Unwrap { data: T, requestId: string } envelope
    const body: unknown = response.data;
    if (body && typeof body === 'object' && 'data' in body) {
      return { ...response, data: (body as ApiResponse<unknown>).data };
    }
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      // If a refresh is already in progress, wait for it
      if (refreshPromise) {
        try {
          const newToken = await refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch {
          return Promise.reject(toApiError(error));
        }
      }

      // Start a new refresh (cookie sent automatically)
      refreshPromise = refreshAccessToken();
      try {
        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        onAuthFailure?.();
        return Promise.reject(toApiError(error));
      } finally {
        refreshPromise = null;
      }
    }

    return Promise.reject(toApiError(error));
  },
);

export async function refreshAccessToken({
  signal,
}: { signal?: AbortSignal } = {}): Promise<string> {
  // Use raw axios to avoid interceptor loops; withCredentials sends the cookie
  const response = await axios.post<ApiResponse<{ accessToken: string }>>(
    '/api/auth/refresh',
    undefined,
    { withCredentials: true, signal },
  );
  const { accessToken: newToken } = response.data.data;
  setAccessToken(newToken);
  return newToken;
}

// ---------------------------------------------------------------------------
// Typed convenience methods
// ---------------------------------------------------------------------------
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await api.get<T>(url, { params });
  return response.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.post<T>(url, body);
  return response.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.patch<T>(url, body);
  return response.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const response = await api.put<T>(url, body);
  return response.data;
}

export async function apiDelete(url: string): Promise<void> {
  await api.delete(url);
}
