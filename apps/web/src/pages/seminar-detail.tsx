import { Layout } from "@/components/layout";
import { AddParticipantDialog } from "@/components/seminar-detail/add-participant-dialog";
import { ParticipantListSection } from "@/components/seminar-detail/participant-list-section";
import { SessionsSection } from "@/components/seminar-detail/sessions-section";
import { LogoutErrorAlert } from "@/components/shared/logout-error-alert";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  createParticipant,
  createSession,
  deleteParticipantFromSeminar,
  fetchParticipants,
  fetchSeminarById,
  fetchSeminarParticipants,
  fetchSessions,
  participantQueryKeys,
  seminarQueryKeys,
  sessionQueryKeys,
  updateSeminar,
} from "@/lib/api";
import { findParticipantByName } from "@/lib/participant-matching";
import { useLogout } from "@/lib/use-logout";
import { formatUtcTimestamp } from "@/lib/utils";
import {
  Alert,
  Box,
  Button,
  Field,
  Flex,
  Heading,
  Input,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LuPencilLine } from "react-icons/lu";
import { useNavigate, useParams } from "react-router";
import {
  ParticipantCreateSchema,
  SeminarUpdateSchema,
  SessionCreateSchema,
} from "schemas";

const SeminarDetailPage = () => {
  const { seminarId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logoutError, isLoggingOut, handleLogout } = useLogout(navigate);
  const [isEditingSeminar, setIsEditingSeminar] = useState(false);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [participantSubmitError, setParticipantSubmitError] = useState<
    string | null
  >(null);
  const [participantToRemove, setParticipantToRemove] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const seminarQuery = useQuery({
    queryKey: seminarQueryKeys.detail(seminarId ?? ""),
    queryFn: () => fetchSeminarById(seminarId ?? ""),
    enabled: !!seminarId,
  });

  const allParticipantsQuery = useQuery({
    queryKey: participantQueryKeys.directory(),
    queryFn: fetchParticipants,
  });

  const participantsQuery = useQuery({
    queryKey: participantQueryKeys.list(seminarId ?? ""),
    queryFn: () => fetchSeminarParticipants(seminarId ?? ""),
    enabled: !!seminarId,
  });

  const sessionsQuery = useQuery({
    queryKey: sessionQueryKeys.list(seminarId ?? ""),
    queryFn: () => fetchSessions(seminarId ?? ""),
    enabled: !!seminarId,
  });

  const seminar = seminarQuery.data?.data ?? null;
  const participants = participantsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const allParticipants = allParticipantsQuery.data ?? [];

  const form = useForm({
    defaultValues: {
      name: seminar?.name ?? "",
      description: seminar?.description ?? "",
      discord_channel_id: seminar?.discord_channel_id ?? "",
      drive_folder_id: seminar?.drive_folder_id ?? "",
    },
    onSubmit: async ({ value }) => {
      if (!seminarId) {
        return;
      }

      const trimmedName = value.name.trim();
      const trimmedDescription = value.description.trim();
      const trimmedDiscordChannelId = value.discord_channel_id.trim();
      const trimmedDriveFolderId = value.drive_folder_id.trim();

      const result = SeminarUpdateSchema.safeParse({
        name: trimmedName,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        discord_channel_id: trimmedDiscordChannelId,
        drive_folder_id:
          trimmedDriveFolderId.length > 0 ? trimmedDriveFolderId : null,
      });

      if (!result.success) {
        const issue = result.error.issues[0];
        setSubmitError(
          issue?.message ?? "Please complete the required seminar fields.",
        );
        return;
      }

      setSubmitError(null);
      await updateMutation.mutateAsync(result.data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateSeminar.bind(null, seminarId ?? ""),
    onSuccess: (response) => {
      void queryClient.setQueryData(
        seminarQueryKeys.detail(seminarId ?? ""),
        response,
      );
      void queryClient.invalidateQueries({
        queryKey: seminarQueryKeys.list(),
        exact: true,
      });
      setSubmitError(null);
      setIsEditingSeminar(false);
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const participantForm = useForm({
    defaultValues: {
      name: "",
      discord_user_id: "",
    },
    onSubmit: async ({ value }) => {
      if (!seminarId) {
        return;
      }

      const normalizedValue = {
        name: value.name.trim(),
        discord_user_id: value.discord_user_id.trim(),
      };

      const result = ParticipantCreateSchema.safeParse(normalizedValue);
      if (!result.success) {
        const issue = result.error.issues[0];
        setParticipantSubmitError(
          issue?.message ?? "Please complete the required participant fields.",
        );
        return;
      }

      setParticipantSubmitError(null);
      await participantMutation.mutateAsync(result.data);
    },
  });

  const existingParticipantMatch = findParticipantByName(
    allParticipants,
    participantForm.state.values.name,
  );

  const syncParticipantSelection = (nextName: string) => {
    const nextMatch = findParticipantByName(allParticipants, nextName);

    if (nextMatch) {
      participantForm.setFieldValue(
        "discord_user_id",
        nextMatch.data.discord_user_id,
      );
      return;
    }

    participantForm.setFieldValue("discord_user_id", "");
  };

  const participantMutation = useMutation({
    mutationFn: (payload: { name: string; discord_user_id: string }) =>
      createParticipant(seminarId ?? "", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: participantQueryKeys.list(seminarId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: participantQueryKeys.directory(),
      });
      participantForm.reset();
      setParticipantSubmitError(null);
      setIsAddParticipantOpen(false);
    },
    onError: (error: Error) => {
      setParticipantSubmitError(error.message);
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId: number) =>
      deleteParticipantFromSeminar(seminarId ?? "", participantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: participantQueryKeys.list(seminarId ?? ""),
      });
      setParticipantToRemove(null);
    },
    onError: (error: Error) => {
      setParticipantSubmitError(error.message);
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: (payload: {
      seminar_id: string;
      session_number: number;
      title: string;
      date: string;
      drive_folder_id?: string | null;
      published_at?: string | null;
      archived_at?: string | null;
    }) => createSession(seminarId ?? "", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sessionQueryKeys.list(seminarId ?? ""),
      });
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const handleCreateSession = async () => {
    if (!seminarId) {
      return;
    }

    const nextSessionNumber =
      sessions.reduce((max, entry) => {
        return Math.max(max, entry.data.session_number);
      }, 0) + 1;

    const candidate = {
      seminar_id: seminarId,
      session_number: nextSessionNumber,
      title: `Session ${String(nextSessionNumber).padStart(2, "0")}`,
      date: new Date().toISOString(),
      drive_folder_id: null,
      published_at: null,
      archived_at: null,
    };

    const parsed = SessionCreateSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setSubmitError(issue?.message ?? "Unable to create a session.");
      return;
    }

    setSubmitError(null);
    try {
      const response = await createSessionMutation.mutateAsync(parsed.data);
      navigate(`/seminars/${seminarId}/sessions/${response.data.id}`);
    } catch {
      // Error state is already handled in mutation onError.
    }
  };

  useEffect(() => {
    if (seminar) {
      form.setFieldValue("name", seminar.name);
      form.setFieldValue("description", seminar.description ?? "");
      form.setFieldValue("discord_channel_id", seminar.discord_channel_id);
      form.setFieldValue("drive_folder_id", seminar.drive_folder_id ?? "");
    }
  }, [form, seminar]);

  if (!seminarId) {
    return (
      <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
        <Box
          bg="black"
          minH="0"
          px={{ base: 6, md: 10 }}
          py={{ base: 8, md: 10 }}
        >
          <Text color="red.300">Seminar id is missing.</Text>
        </Box>
      </Layout>
    );
  }

  if (seminarQuery.isLoading) {
    return (
      <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
        <Box
          bg="black"
          minH="0"
          px={{ base: 6, md: 10 }}
          py={{ base: 8, md: 10 }}
        >
          <Text color="gray.300">Loading seminar…</Text>
        </Box>
      </Layout>
    );
  }

  if (seminarQuery.isError || !seminar) {
    return (
      <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
        <Box
          bg="black"
          minH="0"
          px={{ base: 6, md: 10 }}
          py={{ base: 8, md: 10 }}
        >
          <Alert.Root
            status="error"
            bg="red.950"
            borderColor="red.500"
            color="red.100"
          >
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Unable to load seminar</Alert.Title>
              <Alert.Description>
                {seminarQuery.error instanceof Error
                  ? seminarQuery.error.message
                  : "This seminar could not be found."}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
      <Box
        id="seminarDetailCanvasContainer"
        className="app-canvas"
        bg="transparent"
        minH="0"
        overflowY="hidden"
        px={0}
        py={0}
        color="white"
      >
        <Stack id="seminarDetailMainContainer" gap={8} maxW="1100px" mx="auto">
          <Stack id="seminarDetailHeaderContainer" gap={6}>
            <Flex
              align="flex-start"
              justify="space-between"
              gap={4}
              wrap="wrap"
            >
              <Box flex="1" minW="240px">
                <Text
                  fontSize="xs"
                  letterSpacing="0.22em"
                  textTransform="uppercase"
                  color="gray.400"
                  fontWeight="600"
                >
                  Seminars
                </Text>

                <Heading
                  as="h1"
                  size="4xl"
                  fontWeight="700"
                  color="white"
                  mt={2}
                >
                  {seminar.name}
                </Heading>
                <Text fontSize="md" color="gray.400" mt={4}>
                  {seminar.description ?? "No description provided."}
                </Text>
              </Box>
              <Button
                variant="outline"
                color="gray.100"
                borderColor="whiteAlpha.300"
                onClick={() => {
                  setSubmitError(null);
                  setIsEditingSeminar((open) => !open);
                }}
              >
                <LuPencilLine />
                {isEditingSeminar ? "Close editor" : "Edit seminar"}
              </Button>
            </Flex>

            {isEditingSeminar ? (
              <Box
                as="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void form.handleSubmit();
                }}
                border="1px solid"
                borderColor="whiteAlpha.200"
                bg="whiteAlpha.50"
                borderRadius="xl"
                p={{ base: 4, md: 6 }}
              >
                <Stack gap={5}>
                  <Heading as="h2" size="md">
                    Seminar details
                  </Heading>
                  <form.Field name="name">
                    {(field) => (
                      <Field.Root required>
                        <Field.Label>Seminar name</Field.Label>
                        <Input
                          className="glass-field"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                        />
                      </Field.Root>
                    )}
                  </form.Field>
                  <form.Field name="description">
                    {(field) => (
                      <Field.Root>
                        <Field.Label>Description</Field.Label>
                        <Textarea
                          className="glass-field"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="Optional seminar summary"
                        />
                      </Field.Root>
                    )}
                  </form.Field>
                  <form.Field name="discord_channel_id">
                    {(field) => (
                      <Field.Root required>
                        <Field.Label>Discord channel ID</Field.Label>
                        <Input
                          className="glass-field"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                        />
                      </Field.Root>
                    )}
                  </form.Field>
                  <form.Field name="drive_folder_id">
                    {(field) => (
                      <Field.Root>
                        <Field.Label>Google Drive folder ID</Field.Label>
                        <Input
                          className="glass-field"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="Created automatically when left blank"
                        />
                        <Field.HelperText>
                          Leave blank to let publishing create and store the
                          seminar folder.
                        </Field.HelperText>
                      </Field.Root>
                    )}
                  </form.Field>
                  {submitError ? (
                    <Text color="red.300" fontSize="sm">
                      {submitError}
                    </Text>
                  ) : null}
                  <Flex justify="flex-end" gap={3} wrap="wrap">
                    <Button
                      type="button"
                      variant="ghost"
                      color="gray.300"
                      onClick={() => {
                        form.reset({
                          name: seminar.name,
                          description: seminar.description ?? "",
                          discord_channel_id: seminar.discord_channel_id,
                          drive_folder_id: seminar.drive_folder_id ?? "",
                        });
                        setSubmitError(null);
                        setIsEditingSeminar(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      bg="var(--accent-soft)"
                      color="#111111"
                      _hover={{ bg: "var(--accent-soft-strong)" }}
                      loading={updateMutation.isPending}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending
                        ? "Saving…"
                        : "Save all details"}
                    </Button>
                  </Flex>
                </Stack>
              </Box>
            ) : (
              <Box
                border="1px solid"
                borderColor="whiteAlpha.200"
                bg="whiteAlpha.50"
                borderRadius="lg"
                px={4}
                py={4}
              >
                <Text color="gray.300">
                  Discord channel: {seminar.discord_channel_id}
                </Text>
                <Text color="gray.300" mt={2}>
                  Drive folder:{" "}
                  {seminar.drive_folder_id ?? "Created on first publish"}
                </Text>
                <Flex gap={{ base: 2, md: 6 }} mt={4} wrap="wrap">
                  <Text color="gray.500" fontSize="sm">
                    Created: {formatUtcTimestamp(seminar.created_at)}
                  </Text>
                  <Text color="gray.500" fontSize="sm">
                    Updated: {formatUtcTimestamp(seminar.updated_at)}
                  </Text>
                </Flex>
              </Box>
            )}
          </Stack>

          <ParticipantListSection
            participants={participants.map(({ data }) => ({
              id: data.id,
              name: data.name,
            }))}
            isRemoving={removeParticipantMutation.isPending}
            onRequestRemove={(participant) => {
              setParticipantToRemove(participant);
            }}
            addControl={
              <AddParticipantDialog
                open={isAddParticipantOpen}
                onOpenChange={setIsAddParticipantOpen}
                onCancel={() => setIsAddParticipantOpen(false)}
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void participantForm.handleSubmit();
                }}
                submitError={participantSubmitError}
                isSubmitting={participantMutation.isPending}
              >
                <participantForm.Field name="name">
                  {(field) => (
                    <Field.Root invalid={field.state.meta.errors.length > 0}>
                      <Field.Label>Participant name</Field.Label>
                      <Input
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          const nextName = event.target.value;
                          field.handleChange(nextName);
                          syncParticipantSelection(nextName);
                        }}
                        placeholder="Ada Lovelace"
                        className="glass-field"
                        bg="transparent"
                        borderColor={
                          field.state.meta.errors.length > 0
                            ? "red.400"
                            : "whiteAlpha.200"
                        }
                      />
                      {existingParticipantMatch ? (
                        <Text color="green.300" fontSize="sm" mt={2}>
                          Existing participant found — Discord ID filled in.
                        </Text>
                      ) : null}
                      {field.state.meta.errors.length > 0 ? (
                        <Field.ErrorText>
                          {field.state.meta.errors.join(", ")}
                        </Field.ErrorText>
                      ) : null}
                    </Field.Root>
                  )}
                </participantForm.Field>

                <participantForm.Field name="discord_user_id">
                  {(field) => (
                    <Field.Root invalid={field.state.meta.errors.length > 0}>
                      <Field.Label>Discord user ID</Field.Label>
                      <Input
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder={
                          existingParticipantMatch
                            ? existingParticipantMatch.data.discord_user_id
                            : "1234567890"
                        }
                        className="glass-field"
                        bg="transparent"
                        borderColor={
                          field.state.meta.errors.length > 0
                            ? "red.400"
                            : "whiteAlpha.200"
                        }
                      />
                      {field.state.meta.errors.length > 0 ? (
                        <Field.ErrorText>
                          {field.state.meta.errors.join(", ")}
                        </Field.ErrorText>
                      ) : null}
                    </Field.Root>
                  )}
                </participantForm.Field>
              </AddParticipantDialog>
            }
          />

          <SessionsSection
            isLoading={sessionsQuery.isLoading}
            isError={sessionsQuery.isError}
            errorMessage={
              sessionsQuery.error instanceof Error
                ? sessionsQuery.error.message
                : "Unable to load sessions."
            }
            sessions={sessions.map(({ data }) => ({
              id: data.id,
              sessionNumber: data.session_number,
              title: data.title,
              status: data.status,
            }))}
            canCreate={participants.length > 0}
            isCreating={createSessionMutation.isPending}
            createDisabledReason="Add at least one participant before creating a session"
            onCreateSession={() => {
              void handleCreateSession();
            }}
            onOpenSession={(sessionId) => {
              navigate(`/seminars/${seminarId}/sessions/${sessionId}`);
            }}
          />
        </Stack>
      </Box>

      <ConfirmationDialog
        open={participantToRemove !== null}
        title="Remove participant?"
        description={`${participantToRemove?.name ?? "This participant"} will be removed from this seminar. Their participant record will remain available for other seminars.`}
        confirmLabel="Remove participant"
        isPending={removeParticipantMutation.isPending}
        onCancel={() => setParticipantToRemove(null)}
        onConfirm={() => {
          if (participantToRemove) {
            removeParticipantMutation.mutate(participantToRemove.id);
          }
        }}
      />

      {logoutError ? (
        <LogoutErrorAlert
          id="seminarDetailLogoutErrorAlert"
          message={logoutError}
        />
      ) : null}
    </Layout>
  );
};

export default SeminarDetailPage;
