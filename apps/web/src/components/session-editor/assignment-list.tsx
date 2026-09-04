import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { LuLink } from "react-icons/lu";

type AssignmentItem = {
  id: string;
  participantName: string;
  resourceName: string;
};

type AssignmentListProps = {
  isLoading: boolean;
  assignments: AssignmentItem[];
};

export const AssignmentList = ({
  isLoading,
  assignments,
}: AssignmentListProps) => {
  return (
    <Stack gap={2}>
      {isLoading ? (
        <Text color="gray.400">Loading assignments...</Text>
      ) : assignments.length === 0 ? (
        <Text color="gray.400">No assignments yet.</Text>
      ) : (
        assignments.map((assignment) => (
          <Box
            key={assignment.id}
            borderRadius="md"
            border="1px solid"
            className="glass-panel"
            borderColor="transparent"
            bg="transparent"
            px={3}
            py={2}
          >
            <Text color="gray.400" fontSize="xs" fontWeight="700">
              PARTICIPANT {assignment.participantName}
            </Text>
            <Flex mt={1} align="center" gap={2} color="gray.200">
              <LuLink />
              <Text truncate>{assignment.resourceName}</Text>
            </Flex>
          </Box>
        ))
      )}
    </Stack>
  );
};
