import * as SecureStore from "expo-secure-store";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000";

export type ApiRequestOptions = RequestInit & {
  auth?: boolean;
  json?: unknown;
};

type AuthLifecycleHandlers = {
  onTokenRefreshed?: (accessToken: string) => void;
  onRefreshFailed?: () => void;
};

const ACCESS_TOKEN_KEY = "auth.access_token";
const REFRESH_TOKEN_KEY = "auth.refresh_token";

let authLifecycleHandlers: AuthLifecycleHandlers = {};
let refreshInFlight: Promise<string | null> | null = null;

export function registerAuthLifecycleHandlers(
  handlers: AuthLifecycleHandlers,
): () => void {
  authLifecycleHandlers = handlers;
  return () => {
    if (authLifecycleHandlers === handlers) {
      authLifecycleHandlers = {};
    }
  };
}

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
  authLifecycleHandlers.onRefreshFailed?.();
}

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    await clearStoredSession();
    return null;
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (response.status === 401) {
    await clearStoredSession();
    return null;
  }

  if (!response.ok) {
    throw new Error(`No se pudo renovar la sesión: HTTP ${response.status}`);
  }

  let data: { access_token?: unknown };
  try {
    data = (await response.json()) as { access_token?: unknown };
  } catch {
    throw new Error("La respuesta de renovación no es válida.");
  }

  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("La respuesta de renovación no incluye access_token.");
  }

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.access_token);
  authLifecycleHandlers.onTokenRefreshed?.(data.access_token);
  return data.access_token;
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performTokenRefresh().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function throwResponseError(response: Response): Promise<never> {
  const errorText = await response.text().catch(() => "");
  throw new Error(
    errorText || `Error ${response.status}: ${response.statusText}`,
  );
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { auth = true, json, headers, body, ...rest } = options;

  const finalHeaders = new Headers(headers ?? {});

  if (auth) {
    const token = await getAuthToken();
    if (token) {
      finalHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  let requestBody = body;

  if (json !== undefined) {
    if (
      !(requestBody instanceof FormData) &&
      !finalHeaders.has("Content-Type")
    ) {
      finalHeaders.set("Content-Type", "application/json");
    }

    requestBody = JSON.stringify(json);
  }

  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const initialToken = auth ? await getAuthToken() : null;

  if (initialToken) {
    finalHeaders.set("Authorization", `Bearer ${initialToken}`);
  }

  const sendRequest = (token: string | null) => {
    const requestHeaders = new Headers(finalHeaders);
    if (auth && token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }

    return fetch(url, {
      ...rest,
      body: requestBody,
      headers: requestHeaders,
    });
  };

  let response = await sendRequest(initialToken);

  if (auth && response.status === 401) {
    const latestToken = await getAuthToken();
    const tokenForRetry =
      latestToken && latestToken !== initialToken
        ? latestToken
        : await refreshAccessToken();

    if (tokenForRetry) {
      response = await sendRequest(tokenForRetry);
    }
  }

  if (!response.ok) {
    await throwResponseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return response.text() as unknown as T;
}
