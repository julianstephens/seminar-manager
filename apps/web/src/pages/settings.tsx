import { Layout } from "@/components/layout";
import { IntegrationCard } from "@/components/settings/integration-card";
import { LogoutErrorAlert } from "@/components/shared/logout-error-alert";
import { fetchIntegrationStatus } from "@/lib/api";
import { useLogout } from "@/lib/use-logout";
import {
  Alert,
  Box,
  Button,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { LuBot, LuCloud, LuRefreshCw } from "react-icons/lu";
import { useNavigate } from "react-router";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { logoutError, isLoggingOut, handleLogout } = useLogout(navigate);
  const integrationsQuery = useQuery({
    queryKey: ["integration-status"],
    queryFn: fetchIntegrationStatus,
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
      <Stack id="settingsMainContainer" gap={6} maxW="900px">
        <Flex
          id="settingsHeaderContainer"
          align="center"
          justify="space-between"
          gap={3}
          mb={2}
        >
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

        <Box id="settingsIntegrationsInfo">
          <Heading as="h2" size="lg">
            Integrations
          </Heading>
          <Text color="gray.400" mt={1}>
            Live connectivity checks for services used during publication.
          </Text>
        </Box>

        {integrationsQuery.isLoading ? (
          <Flex
            id="settingsIntegrationsLoadingState"
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
          <Alert.Root id="settingsIntegrationsErrorState" status="error">
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
          <Stack id="settingsIntegrationsList" gap={4}>
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
            <Text id="settingsLastCheckedTime" color="gray.400" fontSize="xs">
              Last checked{" "}
              {new Date(integrationsQuery.data.checked_at).toLocaleString()}
            </Text>
          </Stack>
        ) : null}
      </Stack>

      {logoutError ? (
        <LogoutErrorAlert id="settingsLogoutErrorAlert" message={logoutError} />
      ) : null}
    </Layout>
  );
};

export default SettingsPage;
