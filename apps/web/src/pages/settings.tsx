import { Layout } from "@/components/layout";
import {
  AUTH_TOKEN_KEY,
  authFetch,
  clearStoredToken,
  readApiErrorMessage,
} from "@/utils";
import { Alert, Box, Flex, Heading, Icon, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { LuShieldCheck } from "react-icons/lu";
import type { LogoutResponse } from "schemas";

const SettingsPage = () => {
  const navigate = useNavigate();
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

  return (
    <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
      <Stack gap={6} maxW="900px">
        <Flex align="center" justify="space-between" mb={2}>
          <Heading as="h1" size="2xl" fontWeight="700" color="white">
            Settings
          </Heading>
        </Flex>

        <Box
          className="glass-panel"
          bg="transparent"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="2xl"
          p={6}
        >
          <Stack gap={3}>
            <Flex align="center" gap={3} color="var(--accent-soft)">
              <Icon as={LuShieldCheck} boxSize={5} />
              <Text fontWeight="700">Admin workspace</Text>
            </Flex>
            <Text color="gray.300">
              This workspace is protected by an administrator password. More
              account and integration controls will appear here as they become
              available.
            </Text>
          </Stack>
        </Box>
      </Stack>

      {logoutError ? (
        <Alert.Root
          status="error"
          position="fixed"
          top={5}
          right={5}
          width="sm"
          bg="red.950"
          borderColor="red.500"
          color="red.100"
          zIndex={10}
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
    </Layout>
  );
};

export default SettingsPage;
