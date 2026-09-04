import {
  Box,
  Button,
  Flex,
  Heading,
  Icon,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuChevronRight, LuTrash2 } from "react-icons/lu";

type SeminarCardProps = {
  seminar: {
    id: string;
    name: string;
    description: string | null;
  };
  plannedCount: number;
  nextSessionLabel: string;
  isDeleting: boolean;
  onDelete: () => void;
  onOpen: () => void;
};

export const SeminarCard = ({
  seminar,
  plannedCount,
  nextSessionLabel,
  isDeleting,
  onDelete,
  onOpen,
}: SeminarCardProps) => {
  return (
    <Box
      id={`homeSeminarItem-${seminar.id}`}
      className="glass-panel glass-panel-interactive"
      borderRadius="xl"
      border="1px solid"
      borderColor="var(--border-soft)"
      bg="transparent"
      px={5}
      py={4}
      boxShadow="none"
    >
      <Flex
        id={`homeSeminarItemContent-${seminar.id}`}
        align="center"
        justify="space-between"
        gap={6}
        wrap="wrap"
      >
        <Box id={`homeSeminarDetails-${seminar.id}`} flex="1" minW="260px">
          <Heading
            as="h2"
            fontSize="2xl"
            fontWeight="700"
            color="white"
            lineHeight="1.2"
            mb={2}
          >
            {seminar.name}
          </Heading>
          <Text fontSize="sm" color="gray.300" lineHeight="1.6">
            {seminar.description ?? "No description provided."}
          </Text>
        </Box>

        <Flex
          id={`homeSeminarActions-${seminar.id}`}
          align="center"
          gap={6}
          ml="auto"
        >
          <Stack align="flex-end" gap={1} minW="120px">
            <Text
              fontSize="xs"
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="gray.400"
            >
              Sessions
            </Text>
            <Text fontWeight="700" fontSize="lg" color="white">
              {plannedCount} planned
            </Text>
          </Stack>

          <Stack align="flex-end" gap={1} minW="180px">
            <Text
              fontSize="xs"
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="gray.400"
            >
              Next session
            </Text>
            <Text fontWeight="700" fontSize="md" color="white">
              {nextSessionLabel}
            </Text>
          </Stack>

          <Flex align="center" gap={2}>
            <Button
              size="sm"
              variant="ghost"
              color="red.300"
              _hover={{ bg: "rgba(229, 62, 62, 0.12)" }}
              loading={isDeleting}
              disabled={isDeleting}
              onClick={onDelete}
            >
              <Icon as={LuTrash2} boxSize={4} />
              Delete
            </Button>
            <IconButton
              aria-label={`Open ${seminar.name}`}
              variant="ghost"
              borderRadius="full"
              color="gray.300"
              _hover={{ bg: "whiteAlpha.100" }}
              onClick={onOpen}
            >
              <Icon as={LuChevronRight} boxSize={5} />
            </IconButton>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
};
