import {
    refreshAccessToken,
    registerAuthLifecycleHandlers,
} from "@/services/api";
import * as SecureStore from "expo-secure-store";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

export type AppRole = "conductor" | "admin";

export type AuthUser = {
  sub: string;
  name: string;
  role: AppRole;
  exp?: number;
  iat?: number;
  id_group?: number;
  is_jefe_grupo?: boolean;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  payload: AuthUser;
};

export type LoginResult = {
  success: boolean;
  role?: AppRole;
  message?: string;
};

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const ACCESS_TOKEN_KEY = "auth.access_token";
const REFRESH_TOKEN_KEY = "auth.refresh_token";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function base64UrlToString(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return globalThis.atob(padded);
}

function decodeJwtPayload(token: string): AuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    const decoded = base64UrlToString(parts[1]);
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    const payload = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(payload) as Partial<AuthUser>;

    if (!parsed.role || !parsed.sub || !parsed.name) {
      return null;
    }

    return {
      sub: String(parsed.sub),
      name: String(parsed.name),
      role: parsed.role === "admin" ? "admin" : "conductor",
      exp: parsed.exp,
      iat: parsed.iat,
      id_group: parsed.id_group,
      is_jefe_grupo: parsed.is_jefe_grupo,
    };
  } catch {
    return null;
  }
}

function isTokenExpired(payload: AuthUser | null): boolean {
  if (!payload || typeof payload.exp !== "number") {
    return false;
  }

  return Date.now() / 1000 >= payload.exp;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSecureSession = useCallback(async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }, []);

  const logout = useCallback(async () => {
    await clearSecureSession();
    setSession(null);
  }, [clearSecureSession]);

  const persistSession = useCallback(
    async (accessToken: string, refreshToken?: string | null) => {
      const payload = decodeJwtPayload(accessToken);
      if (!payload || isTokenExpired(payload)) {
        throw new Error("El token almacenado no es válido o ya expiró.");
      }

      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      }

      setSession({
        accessToken,
        refreshToken: refreshToken ?? null,
        payload,
      });
    },
    [logout],
  );

  const restoreSession = useCallback(async () => {
    setIsLoading(true);

    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      let accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      let payload = accessToken ? decodeJwtPayload(accessToken) : null;

      if (!payload || isTokenExpired(payload)) {
        try {
          accessToken = await refreshAccessToken();
        } catch {
          setSession(null);
          return;
        }
        payload = accessToken ? decodeJwtPayload(accessToken) : null;
      }

      if (!accessToken || !payload || isTokenExpired(payload)) {
        await clearSecureSession();
        setSession(null);
        return;
      }

      setSession({
        accessToken,
        refreshToken,
        payload,
      });
    } catch {
      await clearSecureSession();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [clearSecureSession]);

  useEffect(() => {
    return registerAuthLifecycleHandlers({
      onTokenRefreshed: (accessToken) => {
        const payload = decodeJwtPayload(accessToken);
        if (!payload || isTokenExpired(payload)) {
          void clearSecureSession();
          setSession(null);
          return;
        }

        setSession((currentSession) =>
          currentSession
            ? { ...currentSession, accessToken, payload }
            : currentSession,
        );
      },
      onRefreshFailed: () => setSession(null),
    });
  }, [clearSecureSession]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            username,
            password,
          }).toString(),
        });

        const text = await response.text();
        let data: {
          access_token?: string;
          refresh_token?: string;
          detail?: string;
        } | null = null;

        if (text) {
          try {
            data = JSON.parse(text) as {
              access_token?: string;
              refresh_token?: string;
              detail?: string;
            };
          } catch {
            return {
              success: false,
              message: "La respuesta del backend no es válida.",
            };
          }
        }

        if (!response.ok || !data?.access_token) {
          return {
            success: false,
            message: data?.detail ?? "Credenciales inválidas.",
          };
        }

        const payload = decodeJwtPayload(data.access_token);
        if (!payload || isTokenExpired(payload)) {
          return {
            success: false,
            message: "El token recibido es inválido o ya expiró.",
          };
        }

        await persistSession(data.access_token, data.refresh_token ?? null);

        return {
          success: true,
          role: payload.role,
        };
      } catch (error) {
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "No se pudo iniciar sesión.",
        };
      }
    },
    [persistSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.payload ?? null,
      token: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      isAuthenticated: Boolean(session?.payload),
      isLoading,
      login,
      logout,
      restoreSession,
    }),
    [isLoading, login, logout, restoreSession, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
