import {
  Button,
  CloseButton,
  Dialog,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { ReactNode } from "react";

type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const ConfirmationDialog = ({
  open,
  title,
  description,
  children,
  confirmLabel,
  tone = "danger",
  isPending = false,
  onCancel,
  onConfirm,
}: ConfirmationDialogProps) => (
  <Dialog.Root
    open={open}
    onOpenChange={(details) => {
      if (!details.open && !isPending) onCancel();
    }}
    role="alertdialog"
    size="md"
  >
    <Portal>
      <Dialog.Backdrop className="dialog-backdrop" />
      <Dialog.Positioner>
        <Dialog.Content
          className="dialog-glass"
          bg="transparent"
          color="white"
          border="1px solid"
          borderColor="transparent"
          borderRadius="2xl"
        >
          <Dialog.Header px={6} pt={6} pb={2}>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <CloseButton
                size="sm"
                color="gray.300"
                disabled={isPending}
                aria-label="Cancel"
              />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body px={6} py={3}>
            <Stack gap={4}>
              <Dialog.Description asChild>
                <Text color="gray.300" lineHeight="1.6">
                  {description}
                </Text>
              </Dialog.Description>
              {children}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer px={6} pt={3} pb={6}>
            <Button
              variant="ghost"
              color="gray.300"
              disabled={isPending}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              bg={tone === "danger" ? "red.500" : "var(--accent-soft)"}
              color={tone === "danger" ? "white" : "#111111"}
              _hover={{
                bg: tone === "danger" ? "red.600" : "var(--accent-soft-strong)",
              }}
              loading={isPending}
              disabled={isPending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);
