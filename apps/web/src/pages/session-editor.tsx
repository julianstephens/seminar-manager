import {
  assignmentQueryKeys,
  createAssignment,
  createResource,
  fetchAssignments,
  fetchPublicationRecords,
  fetchResources,
  fetchSeminarById,
  fetchSeminarParticipants,
  fetchSessionById,
  participantQueryKeys,
  publicationRecordQueryKeys,
  publishSession,
  resourceQueryKeys,
  saveSessionDraft,
  seminarQueryKeys,
  sessionQueryKeys,
  updateResource,
  updateSession,
} from "@/api";
import { Layout } from "@/components/layout";
import {
  AUTH_TOKEN_KEY,
  authFetch,
  clearStoredToken,
  formatUtcTimestamp,
  readApiErrorMessage,
  useDebounce,
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
  Input,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { LuFileText, LuLink, LuPlus } from "react-icons/lu";
import { useNavigate, useParams } from "react-router";
import {
  AssignmentCreateSchema,
  ResourceCreateSchema,
  SessionUpdateSchema,
  type LogoutResponse,
} from "schemas";

const toDateTimeInputValue = (isoValue: string) => {
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const fromDateTimeInputValue = (dateTimeValue: string) => {
  const parsed = new Date(dateTimeValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const SessionEditorPage = () => {
  const { seminarId, sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null,
  );
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false);
  const [resourceSubmitError, setResourceSubmitError] = useState<string | null>(
    null,
  );
  const [assignmentSubmitError, setAssignmentSubmitError] = useState<
    string | null
  >(null);
  const [placeholderMessage, setPlaceholderMessage] = useState<string | null>(
    null,
  );
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const persistedValuesRef = useRef<{
    title: string;
    date: string;
    status: "scheduled" | "completed" | "canceled";
  } | null>(null);

  const seminarQuery = useQuery({
    queryKey: seminarQueryKeys.detail(seminarId ?? ""),
    queryFn: () => fetchSeminarById(seminarId ?? ""),
    enabled: !!seminarId,
  });

  const sessionQuery = useQuery({
    queryKey: sessionQueryKeys.detail(seminarId ?? "", sessionId ?? ""),
    queryFn: () => fetchSessionById(seminarId ?? "", sessionId ?? ""),
    enabled: !!seminarId && !!sessionId,
  });

  const participantsQuery = useQuery({
    queryKey: participantQueryKeys.list(seminarId ?? ""),
    queryFn: () => fetchSeminarParticipants(seminarId ?? ""),
    enabled: !!seminarId,
  });

  const resourcesQuery = useQuery({
    queryKey: resourceQueryKeys.list(sessionId ?? ""),
    queryFn: () => fetchResources(sessionId ?? ""),
    enabled: !!sessionId,
  });

  const assignmentsQuery = useQuery({
    queryKey: assignmentQueryKeys.list(sessionId ?? ""),
    queryFn: () => fetchAssignments(sessionId ?? ""),
    enabled: !!sessionId,
  });

  const publicationRecordsQuery = useQuery({
    queryKey: publicationRecordQueryKeys.list(sessionId ?? ""),
    queryFn: () => fetchPublicationRecords(sessionId ?? ""),
    enabled: !!sessionId,
  });

  const seminar = seminarQuery.data?.data ?? null;
  const session = sessionQuery.data?.data ?? null;
  const participants = participantsQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const publicationRecords = publicationRecordsQuery.data ?? [];

  const form = useForm({
    defaultValues: {
      title: "",
      date: "",
      status: "scheduled" as "scheduled" | "completed" | "canceled",
      published: false,
    },
    onSubmit: async ({ value }) => {
      if (!seminarId || !sessionId) {
        return;
      }

      const nextDate = fromDateTimeInputValue(value.date);
      if (!nextDate) {
        setSubmitError("Please choose a valid scheduled date and time.");
        return;
      }

      const normalizedPayload = {
        title: value.title.trim(),
        date: nextDate,
        status: value.status,
        published_at: value.published ? new Date().toISOString() : null,
      };

      const parsed = SessionUpdateSchema.safeParse(normalizedPayload);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        setSubmitError(issue?.message ?? "Please correct the session details.");
        return;
      }

      setSubmitError(null);
      await saveMutation.mutateAsync(parsed.data);
    },
  });

  // string key is a stable primitive so useDebounce deps comparison works correctly
  const autoSaveKey = useSelector(
    form.store,
    (s) => `${s.values.title}|${s.values.date}|${s.values.status}`,
  );
  const debouncedAutoSaveKey = useDebounce(autoSaveKey, 1500);

  const invalidateEditorQueries = async () => {
    if (!seminarId || !sessionId) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: sessionQueryKeys.detail(seminarId, sessionId),
    });
    await queryClient.invalidateQueries({
      queryKey: sessionQueryKeys.list(seminarId),
    });
    await queryClient.invalidateQueries({
      queryKey: seminarQueryKeys.detail(seminarId),
    });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: {
      title?: string;
      date?: string;
      status?: "scheduled" | "completed" | "canceled";
      published_at?: string | null;
    }) => updateSession(seminarId ?? "", sessionId ?? "", payload),
    onSuccess: async (response) => {
      void queryClient.setQueryData(
        sessionQueryKeys.detail(seminarId ?? "", sessionId ?? ""),
        response,
      );
      await invalidateEditorQueries();
      setSubmitError(null);
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const draftMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      date: string;
      status: "scheduled" | "completed" | "canceled";
    }) =>
      saveSessionDraft(seminarId ?? "", sessionId ?? "", {
        ...payload,
        published_at: null,
      }),
    onSuccess: async (response) => {
      void queryClient.setQueryData(
        sessionQueryKeys.detail(seminarId ?? "", sessionId ?? ""),
        response,
      );
      await invalidateEditorQueries();
      form.setFieldValue("published", false);
      setSubmitError(null);
      setLastSavedAt(new Date());
      persistedValuesRef.current = {
        title: response.data.title.trim(),
        date: toDateTimeInputValue(response.data.date),
        status: response.data.status,
      };
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const resourceForm = useForm({
    defaultValues: {
      name: "",
      url: "",
      visibility: "private" as "public" | "private",
    },
    onSubmit: async ({ value }) => {
      if (!sessionId) {
        return;
      }

      setResourceSubmitError(null);

      const parsed = ResourceCreateSchema.safeParse({
        session_id: sessionId,
        name: value.name.trim(),
        url: value.url.trim(),
        visibility: value.visibility,
      });

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        setResourceSubmitError(
          issue?.message ?? "Please complete the required resource fields.",
        );
        return;
      }

      await saveResourceMutation.mutateAsync(parsed.data);
    },
  });

  const saveResourceMutation = useMutation({
    mutationFn: (payload: {
      session_id: string;
      name: string;
      url: string;
      visibility: "public" | "private";
    }) => {
      if (editingResourceId) {
        return updateResource(sessionId ?? "", editingResourceId, payload);
      }

      return createResource(sessionId ?? "", payload);
    },
    onSuccess: async (response) => {
      if (!sessionId) {
        return;
      }

      void queryClient.setQueryData(
        resourceQueryKeys.list(sessionId),
        (current: { data: { id: string } }[] | undefined) => {
          const next = current ?? [];

          if (editingResourceId) {
            return next.map((entry) =>
              entry.data.id === response.data.id ? response : entry,
            );
          }

          return [...next, response];
        },
      );
      await queryClient.invalidateQueries({
        queryKey: resourceQueryKeys.list(sessionId),
      });
      resourceForm.reset();
      setEditingResourceId(null);
      setResourceSubmitError(null);
      setIsAddResourceOpen(false);
    },
    onError: (error: Error) => {
      setResourceSubmitError(error.message);
    },
  });

  const assignmentForm = useForm({
    defaultValues: {
      participant_id: "",
      resource_id: "",
      assign_to_everyone: false,
    },
    onSubmit: async ({ value }) => {
      if (!sessionId) {
        return;
      }

      setAssignmentSubmitError(null);

      if (!value.resource_id) {
        setAssignmentSubmitError("Please select a resource.");
        return;
      }

      if (value.assign_to_everyone) {
        const selectedResource = resources.find(
          ({ data: resource }) => resource.id === value.resource_id,
        )?.data;

        if (selectedResource && selectedResource.visibility !== "public") {
          const updatedResource = await updateResource(
            sessionId,
            value.resource_id,
            {
              visibility: "public",
            },
          );

          void queryClient.setQueryData(
            resourceQueryKeys.list(sessionId),
            (
              current:
                | { data: { id: string; visibility: "public" | "private" } }[]
                | undefined,
            ) =>
              (current ?? []).map((resource) =>
                resource.data.id === value.resource_id
                  ? {
                      ...resource,
                      data: {
                        ...resource.data,
                        visibility: updatedResource.data.visibility,
                      },
                    }
                  : resource,
              ),
          );
        }

        const targetParticipants = participants.filter(
          ({ data: participant }) =>
            !assignments.some(
              ({ data: assignment }) =>
                assignment.participant_id === participant.id &&
                assignment.resource_id === value.resource_id,
            ),
        );

        if (targetParticipants.length === 0) {
          setAssignmentSubmitError(
            "This resource is already assigned to every participant.",
          );
          return;
        }

        await createAssignmentMutation.mutateAsync({
          session_id: sessionId,
          participant_ids: targetParticipants.map(
            ({ data: participant }) => participant.id,
          ),
          resource_id: value.resource_id,
        });
        return;
      }

      if (!value.participant_id) {
        setAssignmentSubmitError("Please select a participant.");
        return;
      }

      const parsed = AssignmentCreateSchema.safeParse({
        session_id: sessionId,
        participant_id: Number(value.participant_id),
        resource_id: value.resource_id,
      });

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        setAssignmentSubmitError(
          issue?.message ?? "Please select a participant and resource.",
        );
        return;
      }

      await createAssignmentMutation.mutateAsync(parsed.data);
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (
      payload:
        | { session_id: string; participant_id: number; resource_id: string }
        | {
            session_id: string;
            participant_ids: number[];
            resource_id: string;
          },
    ) => {
      if ("participant_ids" in payload) {
        const createdAssignments: Awaited<
          ReturnType<typeof createAssignment>
        >[] = [];

        for (const participantId of payload.participant_ids) {
          createdAssignments.push(
            await createAssignment(sessionId ?? "", {
              session_id: payload.session_id,
              participant_id: participantId,
              resource_id: payload.resource_id,
            }),
          );
        }

        return createdAssignments;
      }

      return await createAssignment(sessionId ?? "", payload);
    },
    onSuccess: async (response) => {
      if (!sessionId) {
        return;
      }

      const createdAssignments = Array.isArray(response)
        ? response
        : [response];

      void queryClient.setQueryData(
        assignmentQueryKeys.list(sessionId),
        (current: { data: { id: string } }[] | undefined) => {
          const next = current ?? [];
          return [...next, ...createdAssignments];
        },
      );
      await queryClient.invalidateQueries({
        queryKey: assignmentQueryKeys.list(sessionId),
      });
      assignmentForm.reset();
      setAssignmentSubmitError(null);
      setIsAddAssignmentOpen(false);
    },
    onError: (error: Error) => {
      setAssignmentSubmitError(error.message);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (payload: {
      title: string;
      date: string;
      status: "scheduled" | "completed" | "canceled";
    }) =>
      publishSession(seminarId ?? "", sessionId ?? "", {
        ...payload,
        published_at: new Date().toISOString(),
      }),
    onSuccess: async (response) => {
      void queryClient.setQueryData(
        sessionQueryKeys.detail(seminarId ?? "", sessionId ?? ""),
        response,
      );
      await invalidateEditorQueries();
      await queryClient.invalidateQueries({
        queryKey: publicationRecordQueryKeys.list(sessionId ?? ""),
      });
      form.setFieldValue("published", true);
      setSubmitError(null);
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const isPublishingRef = useRef(false);
  isPublishingRef.current = publishMutation.isPending;

  useEffect(() => {
    if (!session) {
      return;
    }
    form.setFieldValue("title", session.title);
    form.setFieldValue("date", toDateTimeInputValue(session.date));
    form.setFieldValue("status", session.status);
    form.setFieldValue("published", Boolean(session.published_at));
    persistedValuesRef.current = {
      title: session.title.trim(),
      date: toDateTimeInputValue(session.date),
      status: session.status,
    };
  }, [form, session]);

  useEffect(() => {
    if (!participants.length || assignmentForm.state.values.participant_id) {
      return;
    }

    assignmentForm.setFieldValue(
      "participant_id",
      String(participants[0]?.data.id ?? ""),
    );
  }, [assignmentForm, participants]);

  useEffect(() => {
    if (!resources.length || assignmentForm.state.values.resource_id) {
      return;
    }

    assignmentForm.setFieldValue("resource_id", resources[0]?.data.id ?? "");
  }, [assignmentForm, resources]);

  useEffect(() => {
    const pv = persistedValuesRef.current;
    if (!pv || !seminarId || !sessionId || isPublishingRef.current) {
      return;
    }

    const values = form.state.values;
    if (
      values.title.trim() === pv.title &&
      values.date === pv.date &&
      values.status === pv.status
    ) {
      return;
    }

    const nextDate = fromDateTimeInputValue(values.date);
    if (!nextDate) {
      return;
    }

    void draftMutation.mutateAsync({
      title: values.title.trim(),
      date: nextDate,
      status: values.status,
    });
  }, [debouncedAutoSaveKey, seminarId, sessionId]);

  const participantById = useMemo(() => {
    return new Map(participants.map(({ data }) => [data.id, data] as const));
  }, [participants]);

  const resourceById = useMemo(() => {
    return new Map(resources.map(({ data }) => [data.id, data] as const));
  }, [resources]);

  const openCreateResourceDialog = () => {
    setEditingResourceId(null);
    setResourceSubmitError(null);
    resourceForm.reset();
    setIsAddResourceOpen(true);
  };

  const openEditResourceDialog = (resource: {
    id: string;
    name: string;
    url: string;
    visibility: "public" | "private";
  }) => {
    setEditingResourceId(resource.id);
    setResourceSubmitError(null);
    resourceForm.setFieldValue("name", resource.name);
    resourceForm.setFieldValue("url", resource.url);
    resourceForm.setFieldValue("visibility", resource.visibility);
    setIsAddResourceOpen(true);
  };

  const handlePlaceholderClick = (label: string) => {
    setPlaceholderMessage(`${label} will be wired in a later iteration.`);
  };

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

  if (!seminarId || !sessionId) {
    return (
      <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
        <Text color="red.300">Missing seminar or session id.</Text>
      </Layout>
    );
  }

  if (seminarQuery.isLoading || sessionQuery.isLoading) {
    return (
      <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
        <Text color="gray.300">Loading session editor...</Text>
      </Layout>
    );
  }

  if (seminarQuery.isError || sessionQuery.isError || !seminar || !session) {
    return (
      <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
        <Alert.Root
          status="error"
          bg="red.950"
          borderColor="red.500"
          color="red.100"
        >
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Unable to load session editor</Alert.Title>
            <Alert.Description>
              {sessionQuery.error instanceof Error
                ? sessionQuery.error.message
                : "The requested session could not be loaded."}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      </Layout>
    );
  }

  const isAnySavePending =
    saveMutation.isPending ||
    draftMutation.isPending ||
    publishMutation.isPending;

  return (
    <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
      <Box color="white" maxW="1240px" mx="auto" pb={28}>
        <Stack gap={6}>
          <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap">
            <Stack gap={2}>
              <Flex
                fontSize="xs"
                letterSpacing="0.16em"
                textTransform="uppercase"
                color="var(--accent-soft)"
                fontWeight="700"
                align="center"
                gap={2}
                cursor="pointer"
                _hover={{ opacity: 0.8 }}
                onClick={() => navigate(`/seminars/${seminarId}`)}
              >
                <Text>{seminar.name}</Text>
                <Text>/</Text>
                <Text>Sessions</Text>
              </Flex>
              <Heading as="h1" size="4xl" fontWeight="700" lineHeight="1.1">
                Session {String(session.session_number).padStart(2, "0")}
              </Heading>
            </Stack>

            <Stack gap={1} align="flex-end">
              <Text color="gray.400" fontSize="sm" mt={2}>
                Last edited {formatUtcTimestamp(session.updated_at)}
              </Text>
              <Text color="gray.400" fontSize="sm">
                {session.published_at
                  ? `Published: ${formatUtcTimestamp(session.published_at)}`
                  : "Not published"}
              </Text>
            </Stack>
          </Flex>

          {submitError ? (
            <Alert.Root
              status="error"
              bg="red.950"
              borderColor="red.500"
              color="red.100"
            >
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Unable to save session</Alert.Title>
                <Alert.Description>{submitError}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          ) : null}

          {placeholderMessage ? (
            <Alert.Root
              status="info"
              bg="whiteAlpha.50"
              borderColor="whiteAlpha.200"
              color="white"
            >
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{placeholderMessage}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          ) : null}

          <Flex
            align="flex-start"
            gap={6}
            direction={{ base: "column", lg: "row" }}
          >
            <Stack flex="1" minW="0" gap={5}>
              <Box
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="var(--panel-elevated)"
                px={5}
                py={5}
              >
                <Stack gap={4}>
                  <Box>
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Session Title
                    </Text>
                    <form.Field name="title">
                      {(field) => (
                        <Input
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={field.handleBlur}
                          bg="black"
                          borderColor="whiteAlpha.200"
                          color="white"
                          _placeholder={{ color: "gray.500" }}
                        />
                      )}
                    </form.Field>
                  </Box>

                  <Box>
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Scheduled At
                    </Text>
                    <form.Field name="date">
                      {(field) => (
                        <Input
                          type="datetime-local"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={field.handleBlur}
                          bg="black"
                          borderColor="whiteAlpha.200"
                          color="white"
                        />
                      )}
                    </form.Field>
                  </Box>

                  <Box>
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Status
                    </Text>
                    <Flex gap={2} wrap="wrap">
                      {(["scheduled", "completed", "canceled"] as const).map(
                        (status) => (
                          <Button
                            key={status}
                            variant={
                              form.state.values.status === status
                                ? "solid"
                                : "outline"
                            }
                            bg={
                              form.state.values.status === status
                                ? "var(--accent-soft)"
                                : "transparent"
                            }
                            color={
                              form.state.values.status === status
                                ? "#111111"
                                : "white"
                            }
                            borderColor="whiteAlpha.300"
                            _hover={{ bg: "whiteAlpha.100" }}
                            onClick={() => form.setFieldValue("status", status)}
                          >
                            {status}
                          </Button>
                        ),
                      )}
                    </Flex>
                  </Box>
                </Stack>
              </Box>

              <Box
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="var(--panel-elevated)"
                px={5}
                py={5}
              >
                <Flex justify="space-between" align="center" mb={3}>
                  <Text
                    fontSize="lg"
                    letterSpacing="0.02em"
                    textTransform="uppercase"
                    fontWeight="700"
                  >
                    Shared Resources
                  </Text>
                  <Dialog.Root
                    open={isAddResourceOpen}
                    onOpenChange={(details) => {
                      if (!details.open) {
                        setEditingResourceId(null);
                        setResourceSubmitError(null);
                        resourceForm.reset();
                      }
                      setIsAddResourceOpen(details.open);
                    }}
                    size="lg"
                  >
                    <Dialog.Trigger asChild>
                      <Button
                        variant="ghost"
                        color="var(--accent-soft)"
                        onClick={openCreateResourceDialog}
                      >
                        <LuPlus />
                        Add Resource
                      </Button>
                    </Dialog.Trigger>

                    <Portal>
                      <Dialog.Backdrop
                        bg="rgba(2, 2, 3, 0.72)"
                        backdropFilter="blur(8px)"
                      />
                      <Dialog.Positioner>
                        <Dialog.Content
                          bg="linear-gradient(180deg, rgba(18, 18, 20, 0.94) 0%, rgba(10, 10, 12, 0.88) 100%)"
                          color="white"
                          border="1px solid"
                          borderColor="rgba(255, 255, 255, 0.12)"
                          borderRadius="2xl"
                          boxShadow="0 24px 48px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255,255,255,0.04)"
                          backdropFilter="blur(18px)"
                        >
                          <Dialog.Header px={6} pt={6} pb={0}>
                            <Heading as="h2" size="lg">
                              {editingResourceId
                                ? "Edit resource"
                                : "Add resource"}
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
                              id="resource-create-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void resourceForm.handleSubmit();
                              }}
                            >
                              <Stack gap={4}>
                                <resourceForm.Field name="name">
                                  {(field) => (
                                    <Field.Root
                                      invalid={
                                        field.state.meta.errors.length > 0
                                      }
                                    >
                                      <Field.Label>Resource name</Field.Label>
                                      <Input
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(event) =>
                                          field.handleChange(event.target.value)
                                        }
                                        placeholder="Reading list"
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
                                </resourceForm.Field>

                                <resourceForm.Field name="url">
                                  {(field) => (
                                    <Field.Root
                                      invalid={
                                        field.state.meta.errors.length > 0
                                      }
                                    >
                                      <Field.Label>Resource URL</Field.Label>
                                      <Input
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(event) =>
                                          field.handleChange(event.target.value)
                                        }
                                        placeholder="https://example.com/resource"
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
                                </resourceForm.Field>

                                <resourceForm.Field name="visibility">
                                  {(field) => (
                                    <Field.Root
                                      invalid={
                                        field.state.meta.errors.length > 0
                                      }
                                    >
                                      <Field.Label>Visibility</Field.Label>
                                      <select
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(event) =>
                                          field.handleChange(
                                            event.target.value as
                                              "public" | "private",
                                          )
                                        }
                                        style={{
                                          width: "100%",
                                          backgroundColor: "black",
                                          border: `1px solid ${
                                            field.state.meta.errors.length > 0
                                              ? "#f56565"
                                              : "rgba(255,255,255,0.2)"
                                          }`,
                                          borderRadius: "0.375rem",
                                          color: "white",
                                          padding: "0.625rem 0.75rem",
                                        }}
                                      >
                                        <option value="private">Private</option>
                                        <option value="public">Public</option>
                                      </select>
                                      {field.state.meta.errors.length > 0 ? (
                                        <Field.ErrorText>
                                          {field.state.meta.errors.join(", ")}
                                        </Field.ErrorText>
                                      ) : null}
                                    </Field.Root>
                                  )}
                                </resourceForm.Field>

                                {resourceSubmitError ? (
                                  <Alert.Root
                                    status="error"
                                    bg="red.950"
                                    borderColor="red.500"
                                    color="red.100"
                                  >
                                    <Alert.Indicator />
                                    <Alert.Content>
                                      <Alert.Title>
                                        {editingResourceId
                                          ? "Unable to save resource"
                                          : "Unable to add resource"}
                                      </Alert.Title>
                                      <Alert.Description>
                                        {resourceSubmitError}
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
                              onClick={() => {
                                setEditingResourceId(null);
                                setResourceSubmitError(null);
                                resourceForm.reset();
                                setIsAddResourceOpen(false);
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              form="resource-create-form"
                              bg="white"
                              color="black"
                              _hover={{ bg: "gray.200" }}
                              loading={saveResourceMutation.isPending}
                              disabled={saveResourceMutation.isPending}
                            >
                              {saveResourceMutation.isPending
                                ? editingResourceId
                                  ? "Saving..."
                                  : "Adding..."
                                : editingResourceId
                                  ? "Save changes"
                                  : "Add resource"}
                            </Button>
                          </Dialog.Footer>
                        </Dialog.Content>
                      </Dialog.Positioner>
                    </Portal>
                  </Dialog.Root>
                </Flex>

                <Stack gap={2}>
                  {resourcesQuery.isLoading ? (
                    <Text color="gray.400">Loading resources...</Text>
                  ) : resources.length === 0 ? (
                    <Text color="gray.400">No resources yet.</Text>
                  ) : (
                    resources.map(({ data: resource }) => (
                      <Flex
                        key={resource.id}
                        align="center"
                        justify="space-between"
                        borderRadius="md"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        bg="whiteAlpha.50"
                        px={3}
                        py={2}
                        gap={3}
                      >
                        <Flex align="center" gap={2} minW="0">
                          <LuFileText />
                          <Text color="white" fontWeight="600" truncate>
                            {resource.name}
                          </Text>
                        </Flex>
                        <Flex
                          gap={3}
                          align="center"
                          color="gray.400"
                          fontSize="sm"
                        >
                          <Text>{resource.visibility}</Text>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => openEditResourceDialog(resource)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            color="red.300"
                            onClick={() =>
                              handlePlaceholderClick("Remove Resource")
                            }
                          >
                            Remove
                          </Button>
                        </Flex>
                      </Flex>
                    ))
                  )}
                </Stack>
              </Box>
            </Stack>

            <Stack w={{ base: "100%", lg: "400px" }} gap={5}>
              <Box
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="var(--panel-elevated)"
                px={5}
                py={5}
              >
                <Flex justify="space-between" align="center" mb={3}>
                  <Text
                    fontSize="lg"
                    letterSpacing="0.02em"
                    textTransform="uppercase"
                    fontWeight="700"
                  >
                    Assignments
                  </Text>
                  <Dialog.Root
                    open={isAddAssignmentOpen}
                    onOpenChange={(details) =>
                      setIsAddAssignmentOpen(details.open)
                    }
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
                        bg="rgba(2, 2, 3, 0.72)"
                        backdropFilter="blur(8px)"
                      />
                      <Dialog.Positioner>
                        <Dialog.Content
                          bg="linear-gradient(180deg, rgba(18, 18, 20, 0.94) 0%, rgba(10, 10, 12, 0.88) 100%)"
                          color="white"
                          border="1px solid"
                          borderColor="rgba(255, 255, 255, 0.12)"
                          borderRadius="2xl"
                          boxShadow="0 24px 48px rgba(0, 0, 0, 0.48), inset 0 1px 0 rgba(255,255,255,0.04)"
                          backdropFilter="blur(18px)"
                        >
                          <Dialog.Header px={6} pt={6} pb={0}>
                            <Heading as="h2" size="lg">
                              Add assignment
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
                              id="assignment-create-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void assignmentForm.handleSubmit();
                              }}
                            >
                              <Stack gap={4}>
                                <assignmentForm.Field name="resource_id">
                                  {(field) => (
                                    <Field.Root
                                      invalid={
                                        field.state.meta.errors.length > 0
                                      }
                                    >
                                      <Field.Label>Resource</Field.Label>
                                      <select
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(event) =>
                                          field.handleChange(event.target.value)
                                        }
                                        style={{
                                          width: "100%",
                                          backgroundColor: "black",
                                          border: `1px solid ${
                                            field.state.meta.errors.length > 0
                                              ? "#f56565"
                                              : "rgba(255,255,255,0.2)"
                                          }`,
                                          borderRadius: "0.375rem",
                                          color: "white",
                                          padding: "0.625rem 0.75rem",
                                        }}
                                      >
                                        <option value="">
                                          Select a resource
                                        </option>
                                        {resources.map(({ data: resource }) => (
                                          <option
                                            key={resource.id}
                                            value={resource.id}
                                          >
                                            {resource.name}
                                          </option>
                                        ))}
                                      </select>
                                      {field.state.meta.errors.length > 0 ? (
                                        <Field.ErrorText>
                                          {field.state.meta.errors.join(", ")}
                                        </Field.ErrorText>
                                      ) : null}
                                    </Field.Root>
                                  )}
                                </assignmentForm.Field>

                                <assignmentForm.Field name="assign_to_everyone">
                                  {(field) => (
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.75rem",
                                        color: "white",
                                        fontWeight: 500,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(event) =>
                                          field.handleChange(
                                            event.target.checked,
                                          )
                                        }
                                      />
                                      Assign to everyone
                                    </label>
                                  )}
                                </assignmentForm.Field>

                                {!assignmentForm.state.values
                                  .assign_to_everyone ? (
                                  <assignmentForm.Field name="participant_id">
                                    {(field) => (
                                      <Field.Root
                                        invalid={
                                          field.state.meta.errors.length > 0
                                        }
                                      >
                                        <Field.Label>Participant</Field.Label>
                                        <select
                                          value={field.state.value}
                                          onBlur={field.handleBlur}
                                          onChange={(event) =>
                                            field.handleChange(
                                              event.target.value,
                                            )
                                          }
                                          style={{
                                            width: "100%",
                                            backgroundColor: "black",
                                            border: `1px solid ${
                                              field.state.meta.errors.length > 0
                                                ? "#f56565"
                                                : "rgba(255,255,255,0.2)"
                                            }`,
                                            borderRadius: "0.375rem",
                                            color: "white",
                                            padding: "0.625rem 0.75rem",
                                          }}
                                        >
                                          <option value="">
                                            Select a participant
                                          </option>
                                          {participants.map(
                                            ({ data: participant }) => (
                                              <option
                                                key={participant.id}
                                                value={String(participant.id)}
                                              >
                                                {participant.name}
                                              </option>
                                            ),
                                          )}
                                        </select>
                                        {field.state.meta.errors.length > 0 ? (
                                          <Field.ErrorText>
                                            {field.state.meta.errors.join(", ")}
                                          </Field.ErrorText>
                                        ) : null}
                                      </Field.Root>
                                    )}
                                  </assignmentForm.Field>
                                ) : null}

                                {assignmentSubmitError ? (
                                  <Alert.Root
                                    status="error"
                                    bg="red.950"
                                    borderColor="red.500"
                                    color="red.100"
                                  >
                                    <Alert.Indicator />
                                    <Alert.Content>
                                      <Alert.Title>
                                        Unable to add assignment
                                      </Alert.Title>
                                      <Alert.Description>
                                        {assignmentSubmitError}
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
                              onClick={() => setIsAddAssignmentOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              form="assignment-create-form"
                              bg="white"
                              color="black"
                              _hover={{ bg: "gray.200" }}
                              loading={createAssignmentMutation.isPending}
                              disabled={createAssignmentMutation.isPending}
                            >
                              {createAssignmentMutation.isPending
                                ? "Adding..."
                                : "Add assignment"}
                            </Button>
                          </Dialog.Footer>
                        </Dialog.Content>
                      </Dialog.Positioner>
                    </Portal>
                  </Dialog.Root>
                </Flex>

                <Stack gap={2}>
                  {assignmentsQuery.isLoading ? (
                    <Text color="gray.400">Loading assignments...</Text>
                  ) : assignments.length === 0 ? (
                    <Text color="gray.400">No assignments yet.</Text>
                  ) : (
                    assignments.map(({ data: assignment }) => {
                      const participant = participantById.get(
                        assignment.participant_id,
                      );
                      const resource = resourceById.get(assignment.resource_id);
                      return (
                        <Box
                          key={assignment.id}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="whiteAlpha.200"
                          bg="whiteAlpha.50"
                          px={3}
                          py={2}
                        >
                          <Text color="gray.400" fontSize="xs" fontWeight="700">
                            PARTICIPANT {participant?.name ?? "Unknown"}
                          </Text>
                          <Flex mt={1} align="center" gap={2} color="gray.200">
                            <LuLink />
                            <Text truncate>
                              {resource?.name ?? "Unlinked resource"}
                            </Text>
                          </Flex>
                        </Box>
                      );
                    })
                  )}
                </Stack>
              </Box>

              <Box
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="var(--panel-elevated)"
                px={5}
                py={5}
              >
                <Text
                  fontSize="lg"
                  letterSpacing="0.02em"
                  textTransform="uppercase"
                  fontWeight="700"
                  mb={3}
                >
                  Publishing
                </Text>

                {/* <form.Field name="published">
                  {(field) => (
                    <Checkbox.Root
                      checked={field.state.value}
                      onCheckedChange={(details) =>
                        field.handleChange(Boolean(details.checked))
                      }
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>Ready to publish</Checkbox.Label>
                    </Checkbox.Root>
                  )}
                </form.Field> */}

                <Stack gap={1} mt={3}>
                  <Text color="gray.400" fontSize="sm">
                    Scheduled for:{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(session.date))}
                  </Text>
                  <Text color="gray.400" fontSize="sm">
                    Published at:{" "}
                    {session.published_at
                      ? formatUtcTimestamp(session.published_at)
                      : "Not published"}
                  </Text>
                </Stack>
              </Box>

              <Box
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="var(--panel-elevated)"
                px={5}
                py={5}
              >
                <Text
                  fontSize="lg"
                  letterSpacing="0.02em"
                  textTransform="uppercase"
                  fontWeight="700"
                  mb={3}
                >
                  Publication Log
                </Text>

                <Stack gap={2}>
                  {publicationRecordsQuery.isLoading ? (
                    <Text color="gray.400">Loading publication records...</Text>
                  ) : publicationRecords.length === 0 ? (
                    <Text color="gray.400">No publication activity yet.</Text>
                  ) : (
                    publicationRecords.slice(0, 5).map(({ data: record }) => (
                      <Flex
                        key={record.id}
                        justify="space-between"
                        align="center"
                        gap={3}
                        borderRadius="md"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        bg="whiteAlpha.50"
                        px={3}
                        py={2}
                      >
                        <Text color="gray.200" textTransform="capitalize">
                          {record.action} ({record.status})
                        </Text>
                        <Text color="gray.500" fontSize="xs">
                          {formatUtcTimestamp(record.created_at)}
                        </Text>
                      </Flex>
                    ))
                  )}
                </Stack>
              </Box>
            </Stack>
          </Flex>
        </Stack>

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
            <Text color="gray.400" fontSize="sm">
              {draftMutation.isPending
                ? "Saving draft…"
                : lastSavedAt !== null
                  ? `Draft saved at ${lastSavedAt.toLocaleTimeString()}`
                  : "Changes will be auto-saved."}
            </Text>
            <Flex gap={3}>
              <Button
                variant="outline"
                borderColor="whiteAlpha.300"
                color="white"
                onClick={() => {
                  const nextDate = fromDateTimeInputValue(
                    form.state.values.date,
                  );
                  if (!nextDate) {
                    setSubmitError(
                      "Please choose a valid scheduled date and time.",
                    );
                    return;
                  }

                  void draftMutation.mutateAsync({
                    title: form.state.values.title.trim(),
                    date: nextDate,
                    status: form.state.values.status,
                  });
                }}
                disabled={isAnySavePending}
                loading={draftMutation.isPending}
              >
                Save Now
              </Button>
              <Button
                bg="var(--accent-soft)"
                color="#111111"
                _hover={{ bg: "var(--accent-soft-strong)" }}
                onClick={() => {
                  const nextDate = fromDateTimeInputValue(
                    form.state.values.date,
                  );
                  if (!nextDate) {
                    setSubmitError(
                      "Please choose a valid scheduled date and time.",
                    );
                    return;
                  }

                  void publishMutation.mutateAsync({
                    title: form.state.values.title.trim(),
                    date: nextDate,
                    status: form.state.values.status,
                  });
                }}
                disabled={isAnySavePending || Boolean(session?.published_at)}
                loading={publishMutation.isPending}
              >
                {session?.published_at ? "Published" : "Publish Session"}
              </Button>
            </Flex>
          </Flex>
        </Box>
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

export default SessionEditorPage;
