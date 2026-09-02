import type { PropsWithChildren } from "react";
import { Navigate } from "react-router";

export const AUTH_TOKEN_KEY = "seminar-manager:access-token";

export const getStoredToken = () => {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
};

export const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/" />;
  }

  return <>{children} </>;
};
