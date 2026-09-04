import {
  Alert,
  Button,
  CloseButton,
  Dialog,
  Portal,
  Stack,
} from "@chakra-ui/react";
import type { PropsWithChildren, SyntheticEvent } from "react";
import { LuPlus } from "react-icons/lu";

type AssignmentDialogProps = PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  submitError: string | null;
  isSubmitting: boolean;
}>;

export const AssignmentDialog = ({
  open,
  onOpenChange,
  onCancel,
  onSubmit,
  submitError,
  isSubmitting,
  children,
}: AssignmentDialogProps) => {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      size="lg"
    >
      <Dialog.Trigger asChild>
        <Button variant="ghost" color="var(--accent-soft)">
          <LuPlus />
          Add Assignment
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
              <Dialog.Title>Add assignment</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton
                  size="sm"
                  color="gray.300"
                  _hover={{ bg: "whiteAlpha.100" }}
                />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body px={6} py={6}>
              <form id="assignment-create-form" onSubmit={onSubmit}>
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
                        <Alert.Title>Unable to add assignment</Alert.Title>
                        <Alert.Description>{submitError}</Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
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
                form="assignment-create-form"
                bg="var(--accent-soft)"
                color="#111111"
                _hover={{ bg: "var(--accent-soft-strong)" }}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add assignment"}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
