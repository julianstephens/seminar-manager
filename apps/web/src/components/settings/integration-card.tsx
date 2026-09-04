import { Box, Flex, Heading, Icon, Text } from "@chakra-ui/react";
import type { IconType } from "react-icons";
import { LuCheck, LuTriangleAlert } from "react-icons/lu";

import type { IntegrationStatus } from "@/lib/api";

type IntegrationCardProps = {
  name: string;
  icon: IconType;
  status: IntegrationStatus;
};

export const IntegrationCard = ({
  name,
  icon,
  status,
}: IntegrationCardProps) => {
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
