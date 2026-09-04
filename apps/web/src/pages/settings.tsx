import { fetchIntegrationStatus, type IntegrationStatus } from "@/api";
import { Layout } from "@/components/layout";
import {
  AUTH_TOKEN_KEY,
  authFetch,
  clearStoredToken,
  readApiErrorMessage,
} from "@/utils";
import {
  Alert,
  Box,
  Button,
  Flex,
  Heading,
  Icon,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  LuBot,
  LuCheck,
  LuCloud,
  LuRefreshCw,
  LuTriangleAlert,
} from "react-icons/lu";
import type { LogoutResponse } from "schemas";

const IntegrationCard = ({
  name,
  icon,
  status,
}: {
  name: string;
  icon: typeof LuBot;
  status: IntegrationStatus;
}) => {
  const connected = status.status === "connected";
  const color = connected
    ? "green.300"
    : status.status === "error"
      ? "red.300"
      : "orange.300";

  return (
    <Box
      className="glass-panel"
      border="1px solid"
      borderColor="var(--border-soft)"
      borderRadius="xl"
      p={5}
    >
      <Flex align="flex-start" justify="space-between" gap={4}>
        <Flex align="center" gap={3}>
          <Icon as={icon} boxSize={6} color="var(--accent-soft)" />
          <Box>
            <Heading as="h2" size="md">
              {name}
            </Heading>
            {status.label ? (
              <Text color="gray.400" fontSize="sm" mt={1}>
                {status.label}
              </Text>
            ) : null}
          </Box>
        </Flex>
        <Flex
          align="center"
          gap={1.5}
          color={color}
          fontSize="sm"
          fontWeight="700"
          textTransform="capitalize"
        >
          <Icon as={connected ? LuCheck : LuTriangleAlert} boxSize={4} />
          {status.status.replace("_", " ")}
        </Flex>
      </Flex>
      <Text color="gray.300" fontSize="sm" mt={4}>
        {status.message}
      </Text>
    </Box>
  );
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const integrationsQuery = useQuery({
    queryKey: ["integration-status"],
    queryFn: fetchIntegrationStatus,
    staleTime: 60_000,
    retry: 1,
  });

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
        <Flex align="center" justify="space-between" gap={3} mb={2}>
          <Heading as="h1" size="2xl" fontWeight="700" color="white">
            Settings
          </Heading>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void integrationsQuery.refetch()}
            loading={integrationsQuery.isFetching}
            disabled={integrationsQuery.isFetching}
          >
            <LuRefreshCw />
            Refresh status
          </Button>
        </Flex>

        <Box>
          <Heading as="h2" size="lg">
            Integrations
          </Heading>
          <Text color="gray.400" mt={1}>
            Live connectivity checks for services used during publication.
          </Text>
        </Box>

        {integrationsQuery.isLoading ? (
          <Flex
            align="center"
            gap={3}
            color="gray.300"
            role="status"
            aria-live="polite"
          >
            <Spinner size="sm" />
            Checking integrations…
          </Flex>
        ) : integrationsQuery.isError ? (
          <Alert.Root status="error">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Unable to check integrations</Alert.Title>
              <Alert.Description>
                <Stack gap={3} align="flex-start">
                  <Text>{integrationsQuery.error.message}</Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void integrationsQuery.refetch()}
                  >
                    Try again
                  </Button>
                </Stack>
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        ) : integrationsQuery.data ? (
          <Stack gap={4}>
            <IntegrationCard
              name="Discord"
              icon={LuBot}
              status={integrationsQuery.data.discord}
            />
            <IntegrationCard
              name="Google Drive"
              icon={LuCloud}
              status={integrationsQuery.data.google_drive}
            />
            <Text color="gray.400" fontSize="xs">
              Last checked{" "}
              {new Date(integrationsQuery.data.checked_at).toLocaleString()}
            </Text>
          </Stack>
        ) : null}
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
