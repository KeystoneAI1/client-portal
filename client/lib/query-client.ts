import { QueryClient, QueryFunction } from "@tanstack/react-query";
import Constants from "expo-constants";

/**
 * Gets the base URL for the Express API server.
 * Uses EXPO_PUBLIC_API_URL env var, or falls back to app.json extra config,
 * then localhost for development.
 */
export function getApiUrl(): string {
  // Expo public env vars (set via EXPO_PUBLIC_API_URL)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }

  // Fallback from app.json extra config
  const extraUrl = Constants.expoConfig?.extra?.apiUrl;
  if (extraUrl) {
    return extraUrl.endsWith("/") ? extraUrl.slice(0, -1) : extraUrl;
  }

  // Default: same origin for web (production), localhost for native dev
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:5000";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
  timeoutMs: number = 120000,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    await throwIfResNotOk(res);
    return res;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
