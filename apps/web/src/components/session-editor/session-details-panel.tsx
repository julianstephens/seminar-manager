import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

type SessionDetailsPanelProps = {
  titleField: ReactNode;
  dateField: ReactNode;
  status: string;
};

export const SessionDetailsPanel = ({
  titleField,
  dateField,
  status,
}: SessionDetailsPanelProps) => {
  return (
    <Box
      id="session-details"
      className="glass-panel"
      borderRadius="xl"
      border="1px solid"
      borderColor="var(--border-soft)"
      bg="transparent"
      px={5}
      py={5}
    >
      <Stack gap={4}>
        <Box>
          <Text color="gray.400" fontSize="sm" mb={2}>
            Session Title
          </Text>
          {titleField}
        </Box>

        <Box>
          <Text color="gray.400" fontSize="sm" mb={2}>
            Scheduled At
          </Text>
          {dateField}
        </Box>

        <Box>
          <Text color="gray.400" fontSize="sm" mb={2}>
            Status
          </Text>
          <Text color="white" fontWeight="600" textTransform="capitalize">
            {status}
          </Text>
          <Text color="gray.400" fontSize="xs" mt={1}>
            Status is derived from readiness and publication activity.
          </Text>
        </Box>
      </Stack>
    </Box>
  );
};
