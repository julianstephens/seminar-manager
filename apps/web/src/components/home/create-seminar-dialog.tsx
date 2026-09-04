import {
  Alert,
  Button,
  CloseButton,
  Dialog,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { PropsWithChildren, SyntheticEvent } from "react";

type CreateSeminarDialogProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  submitError: string | null;
  isLoadingSeminars: boolean;
  isSubmitting: boolean;
}>;

export const CreateSeminarDialog = ({
  open,
  onOpenChange,
  onSubmit,
  onCancel,
  submitError,
  isLoadingSeminars,
  isSubmitting,
  children,
}: CreateSeminarDialogProps) => {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      size="lg"
    >
      <Dialog.Trigger asChild>
        <Button
          alignSelf="flex-start"
          mt={2}
          size="lg"
          bg="var(--accent-soft)"
          color="#111111"
          borderRadius="md"
          px={6}
          _hover={{ bg: "var(--accent-soft-strong)" }}
        >
          + New Seminar
        </Button>
      </Dialog.Trigger>

      <Portal>
        <Dialog.Backdrop
          className="dialog-backdrop"
          bg="rgba(2, 2, 3, 0.72)"
          backdropFilter="blur(8px)"
        />
        <Dialog.Positioner>
          <Dialog.Content
            className="dialog-glass"
            bg="transparent"
            color="white"
            border="1px solid"
            borderColor="transparent"
            borderRadius="2xl"
            boxShadow="none"
            backdropFilter="blur(18px)"
          >
            <Dialog.Header px={6} pt={6} pb={0}>
              <Dialog.Title asChild>
                <Text as="h2" fontSize="xl" fontWeight="600">
                  New seminar
                </Text>
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton
                  size="sm"
                  color="gray.300"
                  _hover={{ bg: "whiteAlpha.100" }}
                />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body px={6} py={6}>
              <form id="seminar-create-form" onSubmit={onSubmit}>
                <Stack gap={4}>
                  {children}

                  {submitError ? (
                    <Alert.Root
                      status="error"
                      bg="red.950"
                      borderColor="red.500"
                      color="red.100"
                    >
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Unable to create seminar</Alert.Title>
                        <Alert.Description>{submitError}</Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  ) : null}

                  {isLoadingSeminars ? (
                    <Text color="gray.300">Loading seminar details…</Text>
                  ) : null}
                </Stack>
              </form>
            </Dialog.Body>

            <Dialog.Footer px={6} pb={6} pt={0}>
              <Button variant="ghost" color="gray.300" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="seminar-create-form"
                bg="var(--accent-soft)"
                color="#111111"
                _hover={{ bg: "var(--accent-soft-strong)" }}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create seminar"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
