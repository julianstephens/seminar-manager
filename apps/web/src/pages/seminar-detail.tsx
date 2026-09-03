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
} from "@/api";
import { Layout } from "@/components/layout";
import {
  AUTH_TOKEN_KEY,
  authFetch,
  clearStoredToken,
  readApiErrorMessage,
} from "@/utils";
import {
  Alert,
  Box,
  Button,
  CloseButton,
  Dialog,
  Field,
  Flex,
  Heading,
  Icon,
  IconButton,
  Input,
  List,
  Portal,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LuCheck,
  LuChevronRight,
  LuPencilLine,
  LuPlus,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { useNavigate, useParams } from "react-router";
import {
  ParticipantCreateSchema,
  SeminarUpdateSchema,
  SessionCreateSchema,
  type LogoutResponse,
} from "schemas";

const SeminarDetailPage = () => {
  const { seminarId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [editingField, setEditingField] = useState<
    "name" | "description" | null
  >(null);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [participantSubmitError, setParticipantSubmitError] = useState<
    string | null
  >(null);

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
    },
    onSubmit: async ({ value }) => {
      if (!seminarId) {
        return;
      }

      const trimmedName = value.name.trim();
      const trimmedDescription = value.description.trim();

      const result = SeminarUpdateSchema.safeParse({
        name: trimmedName,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
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
    mutationFn: (payload: { name?: string; description?: string | null }) =>
      updateSeminar(seminarId ?? "", payload),
    onSuccess: (response) => {
      void queryClient.setQueryData(
        seminarQueryKeys.detail(seminarId ?? ""),
        response,
      );
      void queryClient.invalidateQueries({ queryKey: seminarQueryKeys.all });
      setSubmitError(null);
      setEditingField(null);
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

  const existingParticipantMatch =
    participantForm.state.values.name.trim().length > 0
      ? allParticipants.find(
          ({ data }) =>
            data.name.trim().toLowerCase() ===
            participantForm.state.values.name.trim().toLowerCase(),
        )
      : null;

  const syncParticipantSelection = (nextName: string) => {
    const trimmedName = nextName.trim();
    const nextMatch = trimmedName.length
      ? allParticipants.find(
          ({ data }) =>
            data.name.trim().toLowerCase() === trimmedName.toLowerCase(),
        )
      : null;

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
      status: "scheduled" | "completed" | "canceled";
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
      status: "scheduled" as const,
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
    }
  }, [form, seminar]);

  const handleLogout = async () => {
    const accessToken = sessionStorage.getItem(AUTH_TOKEN_KEY);

    if (!accessToken) {
      clearStoredToken();
      navigate("/");
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      const response = await authFetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        const message = await readApiErrorMessage(
          response,
          "Logout failed to revoke the current session.",
        );
        throw new Error(message);
      }

      const data = (await response.json()) as LogoutResponse;

      if (!data.success) {
        throw new Error(data.message ?? "Invalid session.");
      }

      clearStoredToken();
      navigate("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log out.";
      setLogoutError(message);
    } finally {
      setIsLoggingOut(false);
    }
  };

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
        bg="black"
        minH="0"
        overflowY="hidden"
        px={{ base: 6, md: 10 }}
        py={{ base: 8, md: 10 }}
        color="white"
      >
        <Stack gap={8} maxW="1100px" mx="auto">
          <Flex align="flex-start" justify="space-between" gap={4} wrap="wrap">
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

              <Stack gap={5} mt={2}>
                <Flex align="center" gap={3} wrap="wrap">
                  {editingField === "name" ? (
                    <>
                      <form.Field name="name">
                        {(field) => (
                          <Input
                            value={field.state.value}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            onBlur={field.handleBlur}
                            placeholder="Seminar title"
                            bg="whiteAlpha.50"
                            borderColor="whiteAlpha.200"
                            color="white"
                            _placeholder={{ color: "gray.400" }}
                            flex="1"
                            minW="220px"
                          />
                        )}
                      </form.Field>

                      <Button
                        type="button"
                        onClick={() => {
                          void form.handleSubmit();
                        }}
                        bg="white"
                        color="black"
                        _hover={{ bg: "gray.200" }}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? "Saving…" : "Save"}
                      </Button>

                      <IconButton
                        aria-label="Cancel title edit"
                        variant="ghost"
                        color="gray.300"
                        onClick={() => {
                          form.setFieldValue("name", seminar.name);
                          form.setFieldValue(
                            "description",
                            seminar.description ?? "",
                          );
                          setSubmitError(null);
                          setEditingField(null);
                        }}
                      >
                        <Icon as={LuX} boxSize={4} />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <Heading
                        as="h1"
                        size="4xl"
                        fontWeight="700"
                        color="white"
                      >
                        {seminar.name}
                      </Heading>
                      <IconButton
                        aria-label="Edit seminar title"
                        variant="ghost"
                        color="gray.300"
                        _hover={{ bg: "whiteAlpha.100" }}
                        onClick={() => {
                          setSubmitError(null);
                          setEditingField("name");
                        }}
                      >
                        <Icon as={LuPencilLine} boxSize={4} />
                      </IconButton>
                    </>
                  )}
                </Flex>

                <Flex align="flex-start" gap={3} wrap="wrap">
                  {editingField === "description" ? (
                    <>
                      <form.Field name="description">
                        {(field) => (
                          <Textarea
                            value={field.state.value}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            onBlur={field.handleBlur}
                            placeholder="Add a description"
                            bg="whiteAlpha.50"
                            borderColor="whiteAlpha.200"
                            color="white"
                            minH="120px"
                            resize="vertical"
                            _placeholder={{ color: "gray.400" }}
                            flex="1"
                            minW="260px"
                          />
                        )}
                      </form.Field>

                      <Flex align="center" gap={3}>
                        <Button
                          type="button"
                          onClick={() => {
                            void form.handleSubmit();
                          }}
                          bg="white"
                          color="black"
                          _hover={{ bg: "gray.200" }}
                          disabled={updateMutation.isPending}
                        >
                          <Icon as={LuCheck} boxSize={4} />
                          {updateMutation.isPending ? "Saving…" : "Save"}
                        </Button>

                        <IconButton
                          aria-label="Cancel description edit"
                          variant="ghost"
                          color="gray.300"
                          onClick={() => {
                            form.setFieldValue("name", seminar.name);
                            form.setFieldValue(
                              "description",
                              seminar.description ?? "",
                            );
                            setSubmitError(null);
                            setEditingField(null);
                          }}
                        >
                          <Icon as={LuX} boxSize={4} />
                        </IconButton>
                      </Flex>
                    </>
                  ) : (
                    <>
                      <Text
                        fontSize="md"
                        color="gray.400"
                        flex="1"
                        minW="220px"
                      >
                        {seminar.description ?? "No description provided."}
                      </Text>
                      {seminar.description ? (
                        <IconButton
                          aria-label="Edit seminar description"
                          variant="ghost"
                          color="gray.300"
                          _hover={{ bg: "whiteAlpha.100" }}
                          onClick={() => {
                            setSubmitError(null);
                            setEditingField("description");
                          }}
                        >
                          <Icon as={LuPencilLine} boxSize={4} />
                        </IconButton>
                      ) : null}
                    </>
                  )}
                </Flex>

                {submitError ? (
                  <Text color="red.300" fontSize="sm">
                    {submitError}
                  </Text>
                ) : null}
              </Stack>
            </Box>
          </Flex>

          {/* <Box>
            <Text
              fontSize="xs"
              letterSpacing="0.18em"
              textTransform="uppercase"
              color="gray.400"
              fontWeight="700"
              mb={4}
            >
              Seminar details
            </Text>
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
              {seminar.drive_folder_id ? (
                <Text color="gray.300" mt={2}>
                  Drive folder: {seminar.drive_folder_id}
                </Text>
              ) : null}
              <Stack gap={2} mt={4}>
                <Text color="gray.300" fontSize="sm">
                  Created: {formatUtcTimestamp(seminar.created_at)}
                </Text>
                <Text color="gray.300" fontSize="sm">
                  Updated: {formatUtcTimestamp(seminar.updated_at)}
                </Text>
              </Stack>
            </Box>
          </Box> */}

          <Stack gap={4}>
            <Text
              fontSize="xs"
              letterSpacing="0.18em"
              textTransform="uppercase"
              color="gray.400"
              fontWeight="700"
            >
              Participants ({participants.length})
            </Text>

            <Flex align="center" gap={3} wrap="wrap">
              {participants.length > 0 ? (
                <List.Root display="flex" flexDirection="row" ps={4} gap={8}>
                  {participants.map(({ data: participant }) => (
                    <List.Item key={participant.id}>
                      <Flex align="center" gap={2}>
                        <Text color="white" fontWeight="600">
                          {participant.name.split(" ")[0]}
                        </Text>
                        <Button
                          aria-label={`Remove ${participant.name} from seminar`}
                          variant="ghost"
                          size="xs"
                          color="red.300"
                          _hover={{ bg: "red.950" }}
                          loading={removeParticipantMutation.isPending}
                          disabled={removeParticipantMutation.isPending}
                          onClick={() => {
                            void removeParticipantMutation.mutateAsync(
                              participant.id,
                            );
                          }}
                        >
                          <Icon as={LuTrash2} boxSize={3.5} />
                        </Button>
                      </Flex>
                    </List.Item>
                  ))}
                </List.Root>
              ) : null}

              <Dialog.Root
                open={isAddParticipantOpen}
                onOpenChange={(details) =>
                  setIsAddParticipantOpen(details.open)
                }
                size="lg"
              >
                <Dialog.Trigger asChild>
                  <Button
                    variant="outline"
                    borderRadius="full"
                    borderColor="whiteAlpha.300"
                    borderStyle="dashed"
                    borderWidth="1px"
                    fontSize="sm"
                    color="white"
                    _hover={{ bg: "whiteAlpha.100" }}
                  >
                    <Icon as={LuPlus} boxSize={4} />
                    Add
                  </Button>
                </Dialog.Trigger>

                <Portal>
                  <Dialog.Backdrop />
                  <Dialog.Positioner>
                    <Dialog.Content
                      bg="#1f2126"
                      color="white"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      borderRadius="2xl"
                    >
                      <Dialog.Header px={6} pt={6} pb={0}>
                        <Heading as="h2" size="lg">
                          Add participant
                        </Heading>
                        <Dialog.CloseTrigger asChild>
                          <CloseButton
                            size="sm"
                            color="gray.300"
                            _hover={{ bg: "whiteAlpha.100" }}
                          />
                        </Dialog.CloseTrigger>
                      </Dialog.Header>

                      <Dialog.Body px={6} py={6}>
                        <form
                          id="participant-create-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void participantForm.handleSubmit();
                          }}
                        >
                          <Stack gap={4}>
                            <participantForm.Field name="name">
                              {(field) => (
                                <Field.Root
                                  invalid={field.state.meta.errors.length > 0}
                                >
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
                                    bg="black"
                                    borderColor={
                                      field.state.meta.errors.length > 0
                                        ? "red.400"
                                        : "whiteAlpha.200"
                                    }
                                  />
                                  {existingParticipantMatch ? (
                                    <Text
                                      color="green.300"
                                      fontSize="sm"
                                      mt={2}
                                    >
                                      Existing participant found — Discord ID
                                      filled in.
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
                                <Field.Root
                                  invalid={field.state.meta.errors.length > 0}
                                >
                                  <Field.Label>Discord user ID</Field.Label>
                                  <Input
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(event) =>
                                      field.handleChange(event.target.value)
                                    }
                                    placeholder={
                                      existingParticipantMatch
                                        ? existingParticipantMatch.data
                                            .discord_user_id
                                        : "1234567890"
                                    }
                                    bg="black"
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

                            {participantSubmitError ? (
                              <Alert.Root
                                status="error"
                                bg="red.950"
                                borderColor="red.500"
                                color="red.100"
                              >
                                <Alert.Indicator />
                                <Alert.Content>
                                  <Alert.Title>
                                    Unable to add participant
                                  </Alert.Title>
                                  <Alert.Description>
                                    {participantSubmitError}
                                  </Alert.Description>
                                </Alert.Content>
                              </Alert.Root>
                            ) : null}
                          </Stack>
                        </form>
                      </Dialog.Body>

                      <Dialog.Footer px={6} pb={6} pt={0}>
                        <Button
                          variant="ghost"
                          color="gray.300"
                          onClick={() => setIsAddParticipantOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          form="participant-create-form"
                          bg="white"
                          color="black"
                          _hover={{ bg: "gray.200" }}
                          loading={participantMutation.isPending}
                          disabled={participantMutation.isPending}
                        >
                          {participantMutation.isPending
                            ? "Adding..."
                            : "Add participant"}
                        </Button>
                      </Dialog.Footer>
                    </Dialog.Content>
                  </Dialog.Positioner>
                </Portal>
              </Dialog.Root>
            </Flex>
          </Stack>

          <Box>
            <Text
              fontSize="xs"
              letterSpacing="0.18em"
              textTransform="uppercase"
              color="gray.400"
              fontWeight="700"
              mb={4}
            >
              Sessions
            </Text>

            <Stack gap={3}>
              <Button
                alignSelf="flex-start"
                variant="ghost"
                color="white"
                _hover={{ bg: "whiteAlpha.100" }}
                onClick={() => {
                  void handleCreateSession();
                }}
                loading={createSessionMutation.isPending}
                disabled={createSessionMutation.isPending}
              >
                <Icon as={LuPlus} boxSize={4} />
                {createSessionMutation.isPending
                  ? "Creating..."
                  : "New Session"}
              </Button>

              {sessionsQuery.isLoading ? (
                <Text color="gray.400">Loading sessions...</Text>
              ) : sessionsQuery.isError ? (
                <Text color="red.300">
                  {sessionsQuery.error instanceof Error
                    ? sessionsQuery.error.message
                    : "Unable to load sessions."}
                </Text>
              ) : sessions.length === 0 ? (
                <Text color="gray.400" mt="2" mx="auto">
                  No sessions yet.
                </Text>
              ) : (
                <Stack gap={2}>
                  {sessions.map(({ data: sessionEntry }) => (
                    <Box
                      key={sessionEntry.id}
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      bg="whiteAlpha.50"
                      borderRadius="md"
                      px={3}
                      py={2}
                    >
                      <Flex align="center" justify="space-between" gap={3}>
                        <Box>
                          <Text color="white" fontWeight="700">
                            Session{" "}
                            {String(sessionEntry.session_number).padStart(
                              2,
                              "0",
                            )}
                          </Text>
                          <Text color="gray.300" fontSize="sm">
                            {sessionEntry.title}
                          </Text>
                        </Box>
                        <Flex align="center" gap={2}>
                          <Text
                            px={2}
                            py={1}
                            fontSize="xs"
                            fontWeight="600"
                            borderRadius="md"
                            textTransform="capitalize"
                            bg={
                              sessionEntry.status === "completed"
                                ? "green.950"
                                : sessionEntry.status === "canceled"
                                  ? "red.950"
                                  : "gray.900"
                            }
                            color={
                              sessionEntry.status === "completed"
                                ? "green.300"
                                : sessionEntry.status === "canceled"
                                  ? "red.300"
                                  : "gray.300"
                            }
                          >
                            {sessionEntry.status}
                          </Text>
                          <Text
                            px={2}
                            py={1}
                            fontSize="xs"
                            fontWeight="600"
                            borderRadius="md"
                            textTransform="capitalize"
                            bg={
                              sessionEntry.archived_at
                                ? "orange.950"
                                : sessionEntry.published_at
                                  ? "blue.950"
                                  : "gray.900"
                            }
                            color={
                              sessionEntry.archived_at
                                ? "orange.300"
                                : sessionEntry.published_at
                                  ? "blue.300"
                                  : "gray.300"
                            }
                          >
                            {sessionEntry.archived_at
                              ? "archived"
                              : sessionEntry.published_at
                                ? "published"
                                : "draft"}
                          </Text>
                          <IconButton
                            aria-label={`Open session ${sessionEntry.session_number}`}
                            variant="ghost"
                            color="gray.300"
                            _hover={{ bg: "whiteAlpha.100" }}
                            onClick={() => {
                              navigate(
                                `/seminars/${seminarId}/sessions/${sessionEntry.id}`,
                              );
                            }}
                          >
                            <Icon as={LuChevronRight} boxSize={4} />
                          </IconButton>
                        </Flex>
                      </Flex>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>

      {logoutError ? (
        <Alert.Root
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
              <Text>{logoutError}</Text>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}
    </Layout>
  );
};

export default SeminarDetailPage;
