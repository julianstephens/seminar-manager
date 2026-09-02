import type { PropsWithChildren } from "react";
import { Navigate } from "react-router";
import type { ApiErrorResponse } from "schemas";

export const AUTH_TOKEN_KEY = "seminar-manager:access-token";

export const getStoredToken = () => {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
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

export const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <>{children} </>;
};
