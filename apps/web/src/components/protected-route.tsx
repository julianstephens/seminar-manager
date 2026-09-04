import { getStoredToken } from "@/lib/utils";
import type { PropsWithChildren } from "react";
import { Navigate } from "react-router";

export const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const token = getStoredToken();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <>{children} </>;
};
