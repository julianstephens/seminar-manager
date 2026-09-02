import { AUTH_TOKEN_KEY, readApiErrorMessage } from "@/utils";
import { Alert, Box, Button, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { LogoutResponse } from "schemas";

const HomePage = () => {
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    const accessToken = sessionStorage.getItem(AUTH_TOKEN_KEY);

    if (!accessToken) {
      navigate("/");
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
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

      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      navigate("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log out.";
      setLogoutError(message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Box minH="100vh" bg="black" color="white">
      <Button
        position="absolute"
        top={4}
        right={4}
        variant="outline"
        onClick={() => {
          void handleLogout();
        }}
        loading={isLoggingOut}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Logging out..." : "Log out"}
      </Button>

      {logoutError ? (
        <Alert.Root
          status="error"
          position="absolute"
          top={20}
          right={4}
          width="sm"
          bg="red.950"
          borderColor="red.500"
          color="red.100"
        >
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Logout failed</Alert.Title>
            <Alert.Description>
              <Text>{logoutError}</Text>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}
    </Box>
  );
};

export default HomePage;
