import { Alert, Text } from "@chakra-ui/react";

type LogoutErrorAlertProps = {
  id?: string;
  message: string;
};

export const LogoutErrorAlert = ({ id, message }: LogoutErrorAlertProps) => {
  return (
    <Alert.Root
      id={id}
      status="error"
      position="fixed"
      top={5}
      right={5}
      width="sm"
      bg="red.950"
      borderColor="red.500"
      color="red.100"
      zIndex={10}
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Logout failed</Alert.Title>
        <Alert.Description>
          <Text>{message}</Text>
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};
