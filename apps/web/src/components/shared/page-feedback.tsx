import { Alert, Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

type PageLoadingPanelProps = {
  id?: string;
  message: string;
};

export const PageLoadingPanel = ({ id, message }: PageLoadingPanelProps) => {
  return (
    <Box
      id={id}
      borderRadius="xl"
      border="1px solid"
      borderColor="var(--border-soft)"
      bg="var(--panel-elevated)"
      px={5}
      py={4}
    >
      <Text color="gray.300">{message}</Text>
    </Box>
  );
};

type PageErrorAlertProps = {
  id?: string;
  title: string;
  message: string;
  actions?: ReactNode;
};

export const PageErrorAlert = ({
  id,
  title,
  message,
  actions,
}: PageErrorAlertProps) => {
  return (
    <Alert.Root
      id={id}
      status="error"
      bg="red.950"
      borderColor="red.500"
      color="red.100"
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>
          {actions ? (
            <Stack gap={3} align="flex-start">
              <Text>{message}</Text>
              {actions}
            </Stack>
          ) : (
            message
          )}
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};

type PageEmptyStateProps = {
  id?: string;
  title: string;
  description: string;
};

export const PageEmptyState = ({
  id,
  title,
  description,
}: PageEmptyStateProps) => {
  return (
    <Box
      id={id}
      className="glass-panel"
      borderRadius="xl"
      border="1px dashed"
      borderColor="var(--border-soft)"
      bg="transparent"
      px={5}
      py={8}
      boxShadow="inset 0 1px 0 rgba(255,255,255,0.02)"
    >
      <Stack gap={3} align="center">
        <Text as="h2" fontSize="xl" fontWeight="600" color="white">
          {title}
        </Text>
        <Text color="gray.400" textAlign="center">
          {description}
        </Text>
      </Stack>
    </Box>
  );
};
