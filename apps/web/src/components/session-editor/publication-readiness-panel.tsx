import { Alert, Box, Button, Flex, Stack, Text } from "@chakra-ui/react";

type ReadinessAction = {
  label: string;
  run: () => void;
};

type PublicationReadinessPanelProps = {
  isLoading: boolean;
  isError: boolean;
  ready: boolean;
  issues: string[];
  onRetry: () => void;
  getIssueAction: (issue: string) => ReadinessAction;
  scheduledForLabel: string;
  publishedAtLabel: string;
};

export const PublicationReadinessPanel = ({
  isLoading,
  isError,
  ready,
  issues,
  onRetry,
  getIssueAction,
  scheduledForLabel,
  publishedAtLabel,
}: PublicationReadinessPanelProps) => {
  return (
    <Box
      className="glass-panel"
      borderRadius="xl"
      border="1px solid"
      borderColor="var(--border-soft)"
      bg="transparent"
      px={5}
      py={5}
    >
      <Text
        fontSize="lg"
        letterSpacing="0.02em"
        textTransform="uppercase"
        fontWeight="700"
        mb={3}
      >
        Publishing
      </Text>

      <Stack gap={3} mt={3}>
        {isLoading ? (
          <Text color="gray.400" fontSize="sm">
            Checking publication requirements...
          </Text>
        ) : isError ? (
          <Alert.Root status="error" variant="subtle">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Readiness check unavailable</Alert.Title>
              <Alert.Description>
                <Stack gap={2} align="flex-start">
                  <Text>
                    Publishing is paused until the requirements can be checked.
                  </Text>
                  <Button size="xs" variant="outline" onClick={onRetry}>
                    Try again
                  </Button>
                </Stack>
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        ) : ready ? (
          <Box
            borderRadius="lg"
            border="1px solid"
            borderColor="green.700"
            bg="rgba(34, 197, 94, 0.08)"
            px={4}
            py={3}
          >
            <Text color="green.300" fontWeight="700">
              Ready to publish
            </Text>
            <Text color="gray.300" fontSize="sm" mt={1}>
              All required session details and assignments are in place.
            </Text>
          </Box>
        ) : (
          <Stack gap={2}>
            <Box>
              <Text color="orange.300" fontWeight="700">
                {issues.length} requirement
                {issues.length === 1 ? "" : "s"} remaining
              </Text>
              <Text color="gray.400" fontSize="sm" mt={1}>
                Complete each item below to enable publishing.
              </Text>
            </Box>
            {issues.map((issue) => {
              const action = getIssueAction(issue);
              return (
                <Flex
                  key={issue}
                  align="center"
                  justify="space-between"
                  gap={3}
                  borderRadius="md"
                  border="1px solid"
                  borderColor="orange.800"
                  bg="rgba(251, 146, 60, 0.06)"
                  px={3}
                  py={2}
                >
                  <Text color="orange.100" fontSize="sm">
                    {issue}
                  </Text>
                  <Button
                    size="xs"
                    variant="outline"
                    flexShrink={0}
                    borderColor="orange.700"
                    color="orange.200"
                    onClick={action.run}
                  >
                    {action.label}
                  </Button>
                </Flex>
              );
            })}
          </Stack>
        )}
        <Text color="gray.400" fontSize="sm">
          Scheduled for: {scheduledForLabel}
        </Text>
        <Text color="gray.400" fontSize="sm">
          Published at: {publishedAtLabel}
        </Text>
      </Stack>
    </Box>
  );
};
