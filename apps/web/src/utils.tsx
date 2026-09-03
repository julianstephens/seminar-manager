import type { PropsWithChildren } from "react";
import { Navigate } from "react-router";
import type { ApiErrorResponse } from "schemas";

export const AUTH_TOKEN_KEY = "seminar-manager:access-token";

export const getStoredToken = () => {
  return sessionStorage.getItem(AUTH_TOKEN_KEY) ?? null;
};

export const clearStoredToken = () => {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
};

export const authFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  const token = getStoredToken();

  if (!token) {
    clearStoredToken();
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
    throw new Error("Authentication required.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    clearStoredToken();
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
    throw new Error("Your session is no longer valid. Please log in again.");
  }

  return response;
};

export const readApiErrorMessage = async (
  response: Response,
  fallbackMessage: string,
) => {
  const errorBody = (await response
    .json()
    .catch(() => ({}))) as Partial<ApiErrorResponse>;

  return errorBody.message ?? fallbackMessage;
};

export const formatUtcTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
};

export const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <>{children} </>;
};
