import { Alert, Box, Button, Flex, Stack, Text } from "@chakra-ui/react";

type PublicationRecordItem = {
  id: number;
  action: string;
  status: string;
  error: string | null;
  created_at: string;
};

type RetryStatus = {
  kind: "success" | "error";
  message: string;
};

type PublicationLogPanelProps = {
  retryStatus: RetryStatus | null;
  isLoading: boolean;
  records: PublicationRecordItem[];
  isRetryPending: boolean;
  retryPendingId: number | undefined;
  onRetryRecord: (recordId: number) => void;
  formatTimestamp: (value: string) => string;
};

export const PublicationLogPanel = ({
  retryStatus,
  isLoading,
  records,
  isRetryPending,
  retryPendingId,
  onRetryRecord,
  formatTimestamp,
}: PublicationLogPanelProps) => {
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
        Publication Log
      </Text>

      {retryStatus ? (
        <Alert.Root
          status={retryStatus.kind}
          mb={3}
          bg={retryStatus.kind === "error" ? "red.950" : "green.950"}
          color={retryStatus.kind === "error" ? "red.100" : "green.100"}
        >
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{retryStatus.message}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}

      <Stack gap={2}>
        {isLoading ? (
          <Text color="gray.400">Loading publication records...</Text>
        ) : records.length === 0 ? (
          <Text color="gray.400">No publication activity yet.</Text>
        ) : (
          records.slice(0, 5).map((record) => (
            <Flex
              key={record.id}
              justify="space-between"
              align="center"
              gap={3}
              borderRadius="md"
              border="1px solid"
              className="glass-panel"
              borderColor="transparent"
              bg="transparent"
              px={3}
              py={2}
            >
              <Stack gap={0}>
                <Text color="gray.200" textTransform="capitalize">
                  {record.action.replaceAll("_", " ")} ({record.status})
                </Text>
                {record.error ? (
                  <Text color="red.300" fontSize="xs">
                    {record.error}
                  </Text>
                ) : null}
              </Stack>
              <Flex align="center" gap={2}>
                <Text color="gray.400" fontSize="xs">
                  {formatTimestamp(record.created_at)}
                </Text>
                {record.status === "failed" ? (
                  <Button
                    size="xs"
                    variant="outline"
                    loading={isRetryPending && retryPendingId === record.id}
                    disabled={isRetryPending}
                    onClick={() => onRetryRecord(record.id)}
                  >
                    Retry
                  </Button>
                ) : null}
              </Flex>
            </Flex>
          ))
        )}
      </Stack>
    </Box>
  );
};
