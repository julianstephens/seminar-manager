import {
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuChevronRight, LuPlus } from "react-icons/lu";

type SessionItem = {
  id: string;
  sessionNumber: number;
  title: string;
  status: "draft" | "ready" | "published" | "archived";
};

type SessionsSectionProps = {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string;
  sessions: SessionItem[];
  canCreate: boolean;
  isCreating: boolean;
  createDisabledReason?: string;
  onCreateSession: () => void;
  onOpenSession: (sessionId: string) => void;
};

const getStatusStyles = (status: SessionItem["status"]) => {
  if (status === "archived") {
    return { bg: "orange.950", color: "orange.300" };
  }

  if (status === "published") {
    return { bg: "blue.950", color: "blue.300" };
  }

  if (status === "ready") {
    return { bg: "green.950", color: "green.300" };
  }

  return { bg: "gray.900", color: "gray.300" };
};

export const SessionsSection = ({
  isLoading,
  isError,
  errorMessage,
  sessions,
  canCreate,
  isCreating,
  createDisabledReason,
  onCreateSession,
  onOpenSession,
}: SessionsSectionProps) => {
  return (
    <Box>
      <Text
        fontSize="xs"
        letterSpacing="0.18em"
        textTransform="uppercase"
        color="gray.400"
        fontWeight="700"
        mb={4}
      >
        Sessions
      </Text>

      <Stack gap={3}>
        <Button
          alignSelf="flex-start"
          variant="outline"
          borderColor="var(--border-strong)"
          color="white"
          _hover={{ bg: "var(--panel-elevated-strong)" }}
          onClick={onCreateSession}
          loading={isCreating}
          disabled={isCreating || !canCreate}
          title={!canCreate ? createDisabledReason : undefined}
        >
          <Icon as={LuPlus} boxSize={4} />
          {isCreating ? "Creating..." : "New Session"}
        </Button>

        {isLoading ? (
          <Text color="gray.400">Loading sessions...</Text>
        ) : isError ? (
          <Text color="red.300">{errorMessage}</Text>
        ) : sessions.length === 0 ? (
          <Text color="gray.400" mt="2" mx="auto">
            No sessions yet.
          </Text>
        ) : (
          <Stack gap={2}>
            {sessions.map((sessionEntry) => {
              const statusStyles = getStatusStyles(sessionEntry.status);
              return (
                <Box
                  key={sessionEntry.id}
                  className="glass-panel glass-panel-interactive"
                  border="1px solid"
                  borderColor="transparent"
                  bg="transparent"
                  borderRadius="md"
                  px={3}
                  py={2}
                >
                  <Flex align="center" justify="space-between" gap={3}>
                    <Box>
                      <Text color="white" fontWeight="700">
                        Session{" "}
                        {String(sessionEntry.sessionNumber).padStart(2, "0")}
                      </Text>
                      <Text color="gray.300" fontSize="sm">
                        {sessionEntry.title}
                      </Text>
                    </Box>
                    <Flex align="center" gap={2}>
                      <Text
                        px={2}
                        py={1}
                        fontSize="xs"
                        fontWeight="600"
                        borderRadius="md"
                        textTransform="capitalize"
                        bg={statusStyles.bg}
                        color={statusStyles.color}
                      >
                        {sessionEntry.status}
                      </Text>
                      <IconButton
                        aria-label={`Open session ${sessionEntry.sessionNumber}`}
                        variant="ghost"
                        color="gray.300"
                        _hover={{ bg: "whiteAlpha.100" }}
                        onClick={() => onOpenSession(sessionEntry.id)}
                      >
                        <Icon as={LuChevronRight} boxSize={4} />
                      </IconButton>
                    </Flex>
                  </Flex>
                </Box>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
