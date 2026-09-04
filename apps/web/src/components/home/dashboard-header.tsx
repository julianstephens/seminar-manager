import { Flex, Heading, Text } from "@chakra-ui/react";

type DashboardHeaderProps = {
  activeModuleCount: number;
};

export const DashboardHeader = ({
  activeModuleCount,
}: DashboardHeaderProps) => {
  return (
    <Flex
      id="homeHeaderContainer"
      align="center"
      justify="space-between"
      wrap="wrap"
      gap={3}
      mb={6}
      w="100%"
      minW={0}
    >
      <Heading
        as="h1"
        size="2xl"
        fontWeight="700"
        color="white"
        flex="1 1 220px"
        minW={0}
      >
        Dashboard
      </Heading>
      <Text
        fontSize="sm"
        color="gray.400"
        whiteSpace="nowrap"
        flex="0 1 auto"
        minW={0}
        textAlign="right"
      >
        {activeModuleCount} active modules
      </Text>
    </Flex>
  );
};
