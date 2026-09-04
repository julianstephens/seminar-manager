import {
  archiveSession,
  assignmentQueryKeys,
  createAssignment,
  createResource,
  deleteResource,
  fetchAssignments,
  fetchPublicationRecords,
  fetchResources,
  fetchSeminarById,
  fetchSeminarParticipants,
  fetchSessionById,
  fetchSessionReadiness,
  participantQueryKeys,
  prepareSessionDriveFolder,
  publicationRecordQueryKeys,
  publishSession,
  retryPublication,
  resourceQueryKeys,
  saveSessionDraft,
  seminarQueryKeys,
  sessionQueryKeys,
  updateResource,
  updateSession,
} from "@/api";
import { Layout } from "@/components/layout";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
  Link,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuExternalLink,
  LuFileText,
  LuFolderPlus,
  LuLink,
  LuPlus,
} from "react-icons/lu";
import {
  useBeforeUnload,
  useBlocker,
  useNavigate,
  useParams,
} from "react-router";
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
  const [pendingConfirmation, setPendingConfirmation] = useState<
    | { kind: "delete-resource"; id: string; name: string }
    | { kind: "publish" | "republish" | "archive" }
    | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
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
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "unsaved" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const persistedValuesRef = useRef<{
    title: string;
    date: string;
  } | null>(null);
  const hydratedSessionIdRef = useRef<string | null>(null);

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
  const readinessQuery = useQuery({
    queryKey: ["session-readiness", sessionId],
    queryFn: () => fetchSessionReadiness(sessionId ?? ""),
    enabled: !!sessionId,
  });

  const seminar = seminarQuery.data?.data ?? null;
  const session = sessionQuery.data?.data ?? null;
  const participants = participantsQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const publicationRecords = publicationRecordsQuery.data ?? [];

  const retryPublicationMutation = useMutation({
    mutationFn: retryPublication,
    onMutate: () => setRetryStatus(null),
    onSuccess: () => {
      setRetryStatus({
        kind: "success",
        message: "Publication operation retried successfully.",
      });
    },
    onError: (error: Error) => {
      setRetryStatus({ kind: "error", message: error.message });
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: publicationRecordQueryKeys.list(sessionId ?? ""),
      });
    },
  });

  const form = useForm({
    defaultValues: {
      title: "",
      date: "",
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
    (s) => `${s.values.title}|${s.values.date}`,
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
    await queryClient.invalidateQueries({
      queryKey: ["session-readiness", sessionId],
    });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: {
      title?: string;
      date?: string;
      published_at?: string | null;
    }) => updateSession(seminarId ?? "", sessionId ?? "", payload),
    onSuccess: async () => {
      await invalidateEditorQueries();
      setSubmitError(null);
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const draftMutation = useMutation({
    scope: { id: `session-draft-${sessionId ?? "unknown"}` },
    mutationFn: (payload: { title: string; date: string }) =>
      saveSessionDraft(seminarId ?? "", sessionId ?? "", {
        ...payload,
        published_at: null,
      }),
    onMutate: () => {
      setSaveStatus("saving");
      setSaveError(null);
    },
    onSuccess: async (response, savedValues) => {
      await invalidateEditorQueries();
      form.setFieldValue("published", false);
      setSubmitError(null);
      setLastSavedAt(new Date());
      persistedValuesRef.current = {
        title: response.data.title.trim(),
        date: toDateTimeInputValue(response.data.date),
      };
      const currentValues = form.state.values;
      setSaveStatus(
        currentValues.title.trim() === savedValues.title &&
          fromDateTimeInputValue(currentValues.date) === savedValues.date
          ? "saved"
          : "unsaved",
      );
    },
    onError: (error: Error) => {
      setSaveStatus("error");
      setSaveError(error.message);
    },
  });

  const saveCurrentDraft = () => {
    const values = form.state.values;
    const nextDate = fromDateTimeInputValue(values.date);
    if (!nextDate) {
      setSaveStatus("error");
      setSaveError("Choose a valid scheduled date and time before saving.");
      return;
    }

    draftMutation.mutate({
      title: values.title.trim(),
      date: nextDate,
    });
  };

  const resourceForm = useForm({
    defaultValues: {
      name: "",
      url: "",
      visibility: "individual" as "shared" | "individual",
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
      visibility: "shared" | "individual";
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
      await queryClient.invalidateQueries({
        queryKey: ["session-readiness", sessionId],
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

  const deleteResourceMutation = useMutation({
    mutationFn: (resourceId: string) => deleteResource(resourceId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: resourceQueryKeys.list(sessionId ?? ""),
        }),
        queryClient.invalidateQueries({
          queryKey: ["session-readiness", sessionId ?? ""],
        }),
      ]);
      setPendingConfirmation(null);
      setSubmitError(null);
    },
    onError: (error: Error) => {
      setPendingConfirmation(null);
      setSubmitError(error.message);
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

        if (selectedResource && selectedResource.visibility !== "shared") {
          const updatedResource = await updateResource(
            sessionId,
            value.resource_id,
            {
              visibility: "shared",
            },
          );

          void queryClient.setQueryData(
            resourceQueryKeys.list(sessionId),
            (
              current:
                | {
                    data: { id: string; visibility: "shared" | "individual" };
                  }[]
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
      await queryClient.invalidateQueries({
        queryKey: ["session-readiness", sessionId],
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
    mutationFn: (payload: { title: string; date: string }) =>
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
      setPendingConfirmation(null);
    },
    onError: (error: Error) => {
      setPendingConfirmation(null);
      setSubmitError(error.message);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveSession(sessionId ?? ""),
    onSuccess: async () => {
      await invalidateEditorQueries();
      setPendingConfirmation(null);
      setSubmitError(null);
    },
    onError: (error: Error) => {
      setPendingConfirmation(null);
      setSubmitError(error.message);
    },
  });

  const prepareDriveMutation = useMutation({
    mutationFn: async (payload: { title: string; date: string }) => {
      await updateSession(seminarId ?? "", sessionId ?? "", payload);
      return await prepareSessionDriveFolder(sessionId ?? "");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: sessionQueryKeys.detail(seminarId ?? "", sessionId ?? ""),
        }),
        queryClient.invalidateQueries({
          queryKey: seminarQueryKeys.detail(seminarId ?? ""),
        }),
        queryClient.invalidateQueries({
          queryKey: publicationRecordQueryKeys.list(sessionId ?? ""),
        }),
      ]);
      setSubmitError(null);
    },
    onError: (error: Error) => setSubmitError(error.message),
  });

  const isPublishingRef = useRef(false);
  isPublishingRef.current = publishMutation.isPending;

  useEffect(() => {
    if (!session || hydratedSessionIdRef.current === session.id) {
      return;
    }
    hydratedSessionIdRef.current = session.id;
    form.setFieldValue("title", session.title);
    form.setFieldValue("date", toDateTimeInputValue(session.date));
    form.setFieldValue("published", Boolean(session.published_at));
    persistedValuesRef.current = {
      title: session.title.trim(),
      date: toDateTimeInputValue(session.date),
    };
    setSaveStatus("saved");
    setSaveError(null);
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
    if (values.title.trim() === pv.title && values.date === pv.date) {
      if (!draftMutation.isPending) {
        setSaveStatus("saved");
      }
      return;
    }

    if (!draftMutation.isPending && saveStatus !== "error") {
      setSaveStatus("unsaved");
    }

    const nextDate = fromDateTimeInputValue(values.date);
    if (!nextDate) {
      setSaveStatus("error");
      setSaveError("Choose a valid scheduled date and time before saving.");
      return;
    }

    draftMutation.mutate({
      title: values.title.trim(),
      date: nextDate,
    });
  }, [debouncedAutoSaveKey, seminarId, sessionId]);

  useEffect(() => {
    const pv = persistedValuesRef.current;
    if (!pv) return;

    const values = form.state.values;
    const hasChanges =
      values.title.trim() !== pv.title || values.date !== pv.date;
    if (hasChanges && saveStatus !== "saving" && saveStatus !== "error") {
      setSaveStatus("unsaved");
    }
    if (hasChanges && saveStatus === "error") {
      setSaveError(null);
      setSaveStatus("unsaved");
    }
  }, [autoSaveKey]);

  const hasUncommittedChanges =
    saveStatus === "unsaved" ||
    saveStatus === "saving" ||
    saveStatus === "error";
  const navigationBlocker = useBlocker(hasUncommittedChanges);

  useBeforeUnload(
    (event) => {
      if (hasUncommittedChanges) {
        event.preventDefault();
        event.returnValue = "";
      }
    },
    { capture: true },
  );

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
    visibility: "shared" | "individual";
  }) => {
    setEditingResourceId(resource.id);
    setResourceSubmitError(null);
    resourceForm.setFieldValue("name", resource.name);
    resourceForm.setFieldValue("url", resource.url);
    resourceForm.setFieldValue("visibility", resource.visibility);
    setIsAddResourceOpen(true);
  };

  const scrollToEditorSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const getReadinessAction = (issue: string) => {
    if (issue.includes("session title")) {
      return {
        label: "Add title",
        run: () => {
          scrollToEditorSection("session-details");
          window.setTimeout(() => {
            document.getElementById("session-title")?.focus();
          }, 350);
        },
      };
    }

    if (issue.includes("Discord channel")) {
      return {
        label: "View seminar",
        run: () => navigate(`/seminars/${seminarId}`),
      };
    }

    if (issue.includes("assignment is required")) {
      return resources.length === 0
        ? { label: "Add resource", run: openCreateResourceDialog }
        : {
            label: "Add assignment",
            run: () => setIsAddAssignmentOpen(true),
          };
    }

    if (issue.startsWith("Resource")) {
      const resourceName = issue.match(/Resource “(.+)” needs a URL\./)?.[1];
      const matchingResource = resources.find(
        ({ data: resource }) => resource.name === resourceName,
      )?.data;

      if (matchingResource) {
        return {
          label: "Add URL",
          run: () => openEditResourceDialog(matchingResource),
        };
      }

      return {
        label: "Review resources",
        run: () => scrollToEditorSection("session-resources"),
      };
    }

    return {
      label: "Review assignments",
      run: () => scrollToEditorSection("session-assignments"),
    };
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
              <Stack gap={3} align="flex-start">
                <Text>
                  {sessionQuery.error instanceof Error
                    ? sessionQuery.error.message
                    : seminarQuery.error instanceof Error
                      ? seminarQuery.error.message
                      : "The requested session could not be loaded."}
                </Text>
                <Flex gap={2} wrap="wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void Promise.all([
                        seminarQuery.refetch(),
                        sessionQuery.refetch(),
                      ]);
                    }}
                  >
                    Try again
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/seminars/${seminarId}`)}
                  >
                    Back to seminar
                  </Button>
                </Flex>
              </Stack>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      </Layout>
    );
  }

  const isAnySavePending =
    saveMutation.isPending ||
    draftMutation.isPending ||
    prepareDriveMutation.isPending ||
    publishMutation.isPending ||
    archiveMutation.isPending;

  return (
    <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
      <Box className="app-canvas" color="white" maxW="1240px" mx="auto" pb={28}>
        <Stack gap={6}>
          <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap">
            <Stack gap={2}>
              <Button
                variant="plain"
                fontSize="xs"
                letterSpacing="0.16em"
                textTransform="uppercase"
                color="var(--accent-soft)"
                fontWeight="700"
                alignItems="center"
                gap={2}
                _hover={{ opacity: 0.8 }}
                onClick={() => navigate(`/seminars/${seminarId}`)}
                aria-label={`Back to ${seminar.name} sessions`}
              >
                <Text>{seminar.name}</Text>
                <Text>/</Text>
                <Text>Sessions</Text>
              </Button>
              <Heading as="h1" size="3xl" fontWeight="700" lineHeight="1.1">
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

          {saveStatus === "error" ? (
            <Alert.Root
              status="error"
              bg="red.950"
              borderColor="red.500"
              color="red.100"
            >
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Changes not saved</Alert.Title>
                <Alert.Description>
                  <Flex
                    align={{ base: "flex-start", sm: "center" }}
                    justify="space-between"
                    direction={{ base: "column", sm: "row" }}
                    gap={3}
                  >
                    <Text>{saveError ?? "The draft could not be saved."}</Text>
                    <Button
                      size="sm"
                      variant="outline"
                      flexShrink={0}
                      onClick={saveCurrentDraft}
                    >
                      Retry save
                    </Button>
                  </Flex>
                </Alert.Description>
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
                id="session-details"
                className="glass-panel"
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="transparent"
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
                          id="session-title"
                          aria-label="Session title"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={field.handleBlur}
                          className="glass-field"
                          bg="transparent"
                          borderColor="transparent"
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
                          aria-label="Scheduled date and time"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          onBlur={field.handleBlur}
                          className="glass-field"
                          bg="transparent"
                          borderColor="transparent"
                          color="white"
                        />
                      )}
                    </form.Field>
                  </Box>

                  <Box>
                    <Text color="gray.400" fontSize="sm" mb={2}>
                      Status
                    </Text>
                    <Text
                      color="white"
                      fontWeight="600"
                      textTransform="capitalize"
                    >
                      {session.status}
                    </Text>
                    <Text color="gray.400" fontSize="xs" mt={1}>
                      Status is derived from readiness and publication activity.
                    </Text>
                  </Box>
                </Stack>
              </Box>

              <Box
                id="session-resources"
                className="glass-panel"
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="transparent"
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
                                              "shared" | "individual",
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
                                        <option value="individual">
                                          Individual
                                        </option>
                                        <option value="shared">Shared</option>
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
                              bg="var(--accent-soft)"
                              color="#111111"
                              _hover={{ bg: "var(--accent-soft-strong)" }}
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
                        className="glass-panel"
                        borderColor="transparent"
                        bg="transparent"
                        px={3}
                        py={2}
                        gap={3}
                      >
                        <Flex align="center" gap={2} minW="0" flex="1">
                          <LuFileText />
                          <Box minW="0">
                            <Text color="white" fontWeight="600" truncate>
                              {resource.name}
                            </Text>
                            <Link
                              href={resource.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Text
                                display="block"
                                color="gray.400"
                                maxW="80%"
                                fontSize="xs"
                                truncate
                                _hover={{ color: "var(--accent-soft)" }}
                                _focusVisible={{
                                  outline: "2px solid",
                                  outlineColor: "var(--accent-soft)",
                                  outlineOffset: "2px",
                                  borderRadius: "sm",
                                }}
                              >
                                {resource.url}
                              </Text>
                            </Link>
                          </Box>
                        </Flex>
                        <Flex
                          gap={3}
                          align="center"
                          color="gray.400"
                          fontSize="sm"
                        >
                          <Text>{resource.visibility}</Text>
                          <Link
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button
                              size="xs"
                              variant="ghost"
                              color="var(--accent-soft)"
                              _hover={{ bg: "rgba(216, 179, 140, 0.1)" }}
                            >
                              <LuExternalLink />
                              Open
                            </Button>
                          </Link>
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
                              setPendingConfirmation({
                                kind: "delete-resource",
                                id: resource.id,
                                name: resource.name,
                              })
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
                id="session-assignments"
                className="glass-panel"
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="transparent"
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
                                        className="glass-field"
                                        style={{
                                          width: "100%",
                                          backgroundColor: "transparent",
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
                                      className="assignment-toggle"
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
                                            backgroundColor: "transparent",
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
                              bg="var(--accent-soft)"
                              color="#111111"
                              _hover={{ bg: "var(--accent-soft-strong)" }}
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
                          className="glass-panel"
                          borderColor="transparent"
                          bg="transparent"
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
                className="glass-panel"
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="transparent"
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

                <Stack gap={3} mt={3}>
                  {readinessQuery.isLoading ? (
                    <Text color="gray.400" fontSize="sm">
                      Checking publication requirements…
                    </Text>
                  ) : readinessQuery.isError ? (
                    <Alert.Root status="error" variant="subtle">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Readiness check unavailable</Alert.Title>
                        <Alert.Description>
                          <Stack gap={2} align="flex-start">
                            <Text>
                              Publishing is paused until the requirements can be
                              checked.
                            </Text>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => void readinessQuery.refetch()}
                            >
                              Try again
                            </Button>
                          </Stack>
                        </Alert.Description>
                      </Alert.Content>
                    </Alert.Root>
                  ) : readinessQuery.data?.ready ? (
                    <Box
                      borderRadius="lg"
                      border="1px solid"
                      borderColor="green.700"
                      bg="rgba(34, 197, 94, 0.08)"
                      px={4}
                      py={3}
                    >
                      <Text color="green.300" fontWeight="700">
                        Ready to publish
                      </Text>
                      <Text color="gray.300" fontSize="sm" mt={1}>
                        All required session details and assignments are in
                        place.
                      </Text>
                    </Box>
                  ) : (
                    <Stack gap={2}>
                      <Box>
                        <Text color="orange.300" fontWeight="700">
                          {readinessQuery.data?.issues.length ?? 0} requirement
                          {(readinessQuery.data?.issues.length ?? 0) === 1
                            ? ""
                            : "s"}{" "}
                          remaining
                        </Text>
                        <Text color="gray.400" fontSize="sm" mt={1}>
                          Complete each item below to enable publishing.
                        </Text>
                      </Box>
                      {readinessQuery.data?.issues.map((issue) => {
                        const action = getReadinessAction(issue);
                        return (
                          <Flex
                            key={issue}
                            align="center"
                            justify="space-between"
                            gap={3}
                            borderRadius="md"
                            border="1px solid"
                            borderColor="orange.800"
                            bg="rgba(251, 146, 60, 0.06)"
                            px={3}
                            py={2}
                          >
                            <Text color="orange.100" fontSize="sm">
                              {issue}
                            </Text>
                            <Button
                              size="xs"
                              variant="outline"
                              flexShrink={0}
                              borderColor="orange.700"
                              color="orange.200"
                              onClick={action.run}
                            >
                              {action.label}
                            </Button>
                          </Flex>
                        );
                      })}
                    </Stack>
                  )}
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
                className="glass-panel"
                borderRadius="xl"
                border="1px solid"
                borderColor="var(--border-soft)"
                bg="transparent"
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

                {retryStatus ? (
                  <Alert.Root
                    status={retryStatus.kind}
                    mb={3}
                    bg={retryStatus.kind === "error" ? "red.950" : "green.950"}
                    color={
                      retryStatus.kind === "error" ? "red.100" : "green.100"
                    }
                  >
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>
                        {retryStatus.message}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                ) : null}

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
                        className="glass-panel"
                        borderColor="transparent"
                        bg="transparent"
                        px={3}
                        py={2}
                      >
                        <Stack gap={0}>
                          <Text color="gray.200" textTransform="capitalize">
                            {record.action.replaceAll("_", " ")} (
                            {record.status})
                          </Text>
                          {record.error ? (
                            <Text color="red.300" fontSize="xs">
                              {record.error}
                            </Text>
                          ) : null}
                        </Stack>
                        <Flex align="center" gap={2}>
                          <Text color="gray.400" fontSize="xs">
                            {formatUtcTimestamp(record.created_at)}
                          </Text>
                          {record.status === "failed" ? (
                            <Button
                              size="xs"
                              variant="outline"
                              loading={
                                retryPublicationMutation.isPending &&
                                retryPublicationMutation.variables === record.id
                              }
                              disabled={retryPublicationMutation.isPending}
                              onClick={() =>
                                retryPublicationMutation.mutate(record.id)
                              }
                            >
                              Retry
                            </Button>
                          ) : null}
                        </Flex>
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
            <Stack gap={0} role="status" aria-live="polite" aria-atomic="true">
              <Text color="gray.400" fontSize="sm">
                {saveStatus === "saving"
                  ? "Saving changes…"
                  : saveStatus === "unsaved"
                    ? "Unsaved changes — autosave pending…"
                    : saveStatus === "error"
                      ? "Save failed — your changes are still in this browser."
                      : lastSavedAt !== null
                        ? `Saved at ${lastSavedAt.toLocaleTimeString()}`
                        : "All changes saved."}
              </Text>
              {!readinessQuery.isLoading &&
              readinessQuery.data?.ready === false ? (
                <Text color="orange.300" fontSize="xs">
                  Complete {readinessQuery.data.issues.length} publication
                  requirement
                  {readinessQuery.data.issues.length === 1 ? "" : "s"} above to
                  enable Publish.
                </Text>
              ) : readinessQuery.isError ? (
                <Text color="red.300" fontSize="xs">
                  Publish is unavailable until readiness can be checked.
                </Text>
              ) : null}
            </Stack>
            <Flex gap={3} wrap="wrap">
              {session.drive_folder_id ? (
                <Link
                  href={`https://drive.google.com/drive/folders/${session.drive_folder_id}`}
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
                    void prepareDriveMutation.mutateAsync({
                      title: form.state.values.title.trim(),
                      date: nextDate,
                    });
                  }}
                  disabled={isAnySavePending}
                  loading={prepareDriveMutation.isPending}
                >
                  <LuFolderPlus />
                  Prepare Drive Folder
                </Button>
              )}
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

                  saveCurrentDraft();
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

                  setPendingConfirmation({
                    kind: session.published_at ? "republish" : "publish",
                  });
                }}
                disabled={
                  isAnySavePending || readinessQuery.data?.ready !== true
                }
                loading={publishMutation.isPending}
              >
                {session?.published_at
                  ? "Republish Session"
                  : "Publish Session"}
              </Button>
              {session?.published_at && !session?.archived_at ? (
                <Button
                  variant="outline"
                  borderColor="whiteAlpha.300"
                  color="white"
                  disabled={isAnySavePending}
                  onClick={() => {
                    setPendingConfirmation({ kind: "archive" });
                  }}
                >
                  Archive Session
                </Button>
              ) : null}
            </Flex>
          </Flex>
        </Box>
      </Box>

      <ConfirmationDialog
        open={pendingConfirmation !== null}
        title={
          pendingConfirmation?.kind === "delete-resource"
            ? "Delete resource?"
            : pendingConfirmation?.kind === "archive"
              ? "Archive session?"
              : pendingConfirmation?.kind === "republish"
                ? "Republish session?"
                : "Publish session?"
        }
        description={
          pendingConfirmation?.kind === "delete-resource"
            ? `“${pendingConfirmation.name}” and its participant assignments will be permanently deleted. This action cannot be undone.`
            : pendingConfirmation?.kind === "archive"
              ? "This session will be archived and an archive update may be sent to connected services."
              : pendingConfirmation?.kind === "republish"
                ? `This will update the published session in Google Drive and Discord for ${participants.length} participant${participants.length === 1 ? "" : "s"}.`
                : `This will publish the session to Google Drive and Discord for ${participants.length} participant${participants.length === 1 ? "" : "s"}.`
        }
        confirmLabel={
          pendingConfirmation?.kind === "delete-resource"
            ? "Delete resource"
            : pendingConfirmation?.kind === "archive"
              ? "Archive session"
              : pendingConfirmation?.kind === "republish"
                ? "Republish session"
                : "Publish session"
        }
        tone={
          pendingConfirmation?.kind === "publish" ||
          pendingConfirmation?.kind === "republish"
            ? "primary"
            : "danger"
        }
        isPending={
          deleteResourceMutation.isPending ||
          publishMutation.isPending ||
          archiveMutation.isPending
        }
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => {
          if (pendingConfirmation?.kind === "delete-resource") {
            deleteResourceMutation.mutate(pendingConfirmation.id);
            return;
          }
          if (pendingConfirmation?.kind === "archive") {
            archiveMutation.mutate();
            return;
          }
          if (
            pendingConfirmation?.kind === "publish" ||
            pendingConfirmation?.kind === "republish"
          ) {
            const nextDate = fromDateTimeInputValue(form.state.values.date);
            if (!nextDate) {
              setPendingConfirmation(null);
              setSubmitError("Please choose a valid scheduled date and time.");
              return;
            }
            publishMutation.mutate({
              title: form.state.values.title.trim(),
              date: nextDate,
            });
          }
        }}
      />

      <ConfirmationDialog
        open={navigationBlocker.state === "blocked"}
        title="Leave with unsaved changes?"
        description={
          saveStatus === "saving"
            ? "Your changes are still saving. Leaving now may discard them."
            : saveStatus === "error"
              ? "The latest changes could not be saved. Leaving now will discard them."
              : "Your latest changes have not been saved yet. Leaving now will discard them."
        }
        confirmLabel="Leave without saving"
        onCancel={() => navigationBlocker.reset?.()}
        onConfirm={() => navigationBlocker.proceed?.()}
      />

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
