import { useState } from "react";
import type { NavigateFunction } from "react-router";
import type { LogoutResponse } from "schemas";

import {
  AUTH_TOKEN_KEY,
  authFetch,
  clearStoredToken,
  readApiErrorMessage,
} from "@/lib/utils";

type UseLogoutResult = {
  logoutError: string | null;
  isLoggingOut: boolean;
  handleLogout: () => Promise<void>;
};

export const useLogout = (navigate: NavigateFunction): UseLogoutResult => {
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    const accessToken = sessionStorage.getItem(AUTH_TOKEN_KEY);

    if (!accessToken) {
      clearStoredToken();
      navigate("/");
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      const response = await authFetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        const message = await readApiErrorMessage(
          response,
          "Logout failed to revoke the current session.",
        );
        throw new Error(message);
      }

      const data = (await response.json()) as LogoutResponse;

      if (!data.success) {
        throw new Error(data.message ?? "Invalid session.");
      }

      clearStoredToken();
      navigate("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log out.";
      setLogoutError(message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    logoutError,
    isLoggingOut,
    handleLogout,
  };
};
