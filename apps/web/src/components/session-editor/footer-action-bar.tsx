import { Box, Button, Flex, Link, Stack, Text } from "@chakra-ui/react";
import { LuExternalLink, LuFolderPlus } from "react-icons/lu";

type FooterActionBarProps = {
  saveStatus: "idle" | "unsaved" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
  readinessIsLoading: boolean;
  readinessIsError: boolean;
  readinessReady: boolean;
  readinessIssueCount: number;
  driveFolderId: string | null;
  isAnySavePending: boolean;
  isPrepareDrivePending: boolean;
  isDraftPending: boolean;
  isPublishPending: boolean;
  isPublished: boolean;
  isArchived: boolean;
  onPrepareDrive: () => void;
  onSaveNow: () => void;
  onPublish: () => void;
  onArchive: () => void;
};

export const FooterActionBar = ({
  saveStatus,
  lastSavedAt,
  readinessIsLoading,
  readinessIsError,
  readinessReady,
  readinessIssueCount,
  driveFolderId,
  isAnySavePending,
  isPrepareDrivePending,
  isDraftPending,
  isPublishPending,
  isPublished,
  isArchived,
  onPrepareDrive,
  onSaveNow,
  onPublish,
  onArchive,
}: FooterActionBarProps) => {
  return (
    <Box
      position="fixed"
      left={{ base: 0, md: "var(--sidebar-width, 260px)" }}
      right={0}
      bottom={0}
      bg="rgba(6, 6, 8, 0.92)"
      borderTop="1px solid"
      borderColor="var(--border-soft)"
      backdropFilter="blur(12px)"
      px={{ base: 6, md: 10 }}
      py={4}
      zIndex={9}
    >
      <Flex
        justify="space-between"
        align="center"
        maxW="1240px"
        mx="auto"
        gap={3}
        wrap="wrap"
      >
        <Stack gap={0} role="status" aria-live="polite" aria-atomic="true">
          <Text color="gray.400" fontSize="sm">
            {saveStatus === "saving"
              ? "Saving changes..."
              : saveStatus === "unsaved"
                ? "Unsaved changes - autosave pending..."
                : saveStatus === "error"
                  ? "Save failed - your changes are still in this browser."
                  : lastSavedAt !== null
                    ? `Saved at ${lastSavedAt.toLocaleTimeString()}`
                    : "All changes saved."}
          </Text>
          {!readinessIsLoading && !readinessReady ? (
            <Text color="orange.300" fontSize="xs">
              Complete {readinessIssueCount} publication requirement
              {readinessIssueCount === 1 ? "" : "s"} above to enable Publish.
            </Text>
          ) : readinessIsError ? (
            <Text color="red.300" fontSize="xs">
              Publish is unavailable until readiness can be checked.
            </Text>
          ) : null}
        </Stack>
        <Flex gap={3} wrap="wrap">
          {driveFolderId ? (
            <Link
              href={`https://drive.google.com/drive/folders/${driveFolderId}`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                borderColor="whiteAlpha.300"
                color="white"
              >
                <LuExternalLink />
                Open Drive Folder
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              borderColor="whiteAlpha.300"
              color="white"
              onClick={onPrepareDrive}
              disabled={isAnySavePending}
              loading={isPrepareDrivePending}
            >
              <LuFolderPlus />
              Prepare Drive Folder
            </Button>
          )}
          <Button
            variant="outline"
            borderColor="whiteAlpha.300"
            color="white"
            onClick={onSaveNow}
            disabled={isAnySavePending}
            loading={isDraftPending}
          >
            Save Now
          </Button>
          <Button
            bg="var(--accent-soft)"
            color="#111111"
            _hover={{ bg: "var(--accent-soft-strong)" }}
            onClick={onPublish}
            disabled={isAnySavePending || !readinessReady}
            loading={isPublishPending}
          >
            {isPublished ? "Republish Session" : "Publish Session"}
          </Button>
          {isPublished && !isArchived ? (
            <Button
              variant="outline"
              borderColor="whiteAlpha.300"
              color="white"
              disabled={isAnySavePending}
              onClick={onArchive}
            >
              Archive Session
            </Button>
          ) : null}
        </Flex>
      </Flex>
    </Box>
  );
};
