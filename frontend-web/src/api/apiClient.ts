import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5080';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

apiClient.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only treat a 401 as "session expired" when the request actually carried a token —
    // an invalid-credentials response from /login or /register is not a session expiry.
    if (axios.isAxiosError(error) && error.response?.status === 401 && authToken) {
      onSessionExpired?.();
    }
    return Promise.reject(error);
  },
);

export type ApiProblem = {
  title?: string;
  detail?: string;
  status?: number;
};

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const problem = error.response?.data as ApiProblem | undefined;
    return problem?.title ?? problem?.detail ?? fallback;
  }
  return fallback;
}

export type FieldError = { field: string; message: string };

export function extractFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error)) {
    return {};
  }
  const errors = (error.response?.data as { errors?: FieldError[] } | undefined)?.errors;
  if (!Array.isArray(errors)) {
    return {};
  }
  return errors.reduce<Record<string, string>>((acc, e) => {
    acc[e.field] = e.message;
    return acc;
  }, {});
}
