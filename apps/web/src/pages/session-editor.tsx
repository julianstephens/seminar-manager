import { Layout } from "@/components/layout";
import { AssignmentDialog } from "@/components/session-editor/assignment-dialog";
import { AssignmentList } from "@/components/session-editor/assignment-list";
import { FooterActionBar } from "@/components/session-editor/footer-action-bar";
import { PublicationLogPanel } from "@/components/session-editor/publication-log-panel";
import { PublicationReadinessPanel } from "@/components/session-editor/publication-readiness-panel";
import { ResourceDialog } from "@/components/session-editor/resource-dialog";
import { ResourceList } from "@/components/session-editor/resource-list";
import { SessionDetailsPanel } from "@/components/session-editor/session-details-panel";
import { LogoutErrorAlert } from "@/components/shared/logout-error-alert";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
  resourceQueryKeys,
  retryPublication,
  saveSessionDraft,
  seminarQueryKeys,
  sessionQueryKeys,
  updateResource,
  updateSession,
} from "@/lib/api";
import {
  fromDateTimeInputValue,
  toDateTimeInputValue,
} from "@/lib/session-date-time";
import { getReadinessActionSpec } from "@/lib/session-readiness";
import { useLogout } from "@/lib/use-logout";
import { formatUtcTimestamp, useDebounce } from "@/lib/utils";
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
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
  type SessionResponse,
} from "schemas";

const SessionEditorPage = () => {
  const { seminarId, sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { logoutError, isLoggingOut, handleLogout } = useLogout(navigate);
  const [pendingConfirmation, setPendingConfirmation] = useState<
    | { kind: "delete-resource"; id: string; name: string }
    | { kind: "publish" | "republish" | "archive" }
    | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [messageAppendix, setMessageAppendix] = useState("");
  const [publishNotifications, setPublishNotifications] = useState({
    channel_message: true,
    participant_dms: true,
  });
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
    mutationFn: (payload: {
      message_appendix?: string;
      notifications: {
        channel_message: boolean;
        participant_dms: boolean;
      };
    }) =>
      publishSession(seminarId ?? "", sessionId ?? "", {
        ...payload,
      }),
    onSuccess: async () => {
      void queryClient.setQueryData(
        sessionQueryKeys.detail(seminarId ?? "", sessionId ?? ""),
        (current: SessionResponse | undefined) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            data: {
              ...current.data,
              published_at: new Date().toISOString(),
              status: "published",
            },
          };
        },
      );
      await invalidateEditorQueries();
      await queryClient.invalidateQueries({
        queryKey: publicationRecordQueryKeys.list(sessionId ?? ""),
      });
      form.setFieldValue("published", true);
      setSubmitError(null);
      setMessageAppendix("");
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

  useEffect(() => {
    isPublishingRef.current = publishMutation.isPending;
  }, [publishMutation.isPending]);

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

  const resourceItems = resources.map(({ data }) => ({
    id: data.id,
    name: data.name,
    url: data.url,
    visibility: data.visibility,
  }));

  const assignmentItems = assignments.map(({ data }) => ({
    id: data.id,
    participantName:
      participantById.get(data.participant_id)?.name ?? "Unknown",
    resourceName:
      resourceById.get(data.resource_id)?.name ?? "Unlinked resource",
  }));

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
    const spec = getReadinessActionSpec(issue, resources.length > 0);

    if (spec.kind === "focus-title") {
      return {
        label: spec.label,
        run: () => {
          scrollToEditorSection("session-details");
          window.setTimeout(() => {
            document.getElementById("session-title")?.focus();
          }, 350);
        },
      };
    }

    if (spec.kind === "view-seminar") {
      return {
        label: spec.label,
        run: () => navigate(`/seminars/${seminarId}`),
      };
    }

    if (spec.kind === "add-resource") {
      return {
        label: spec.label,
        run: openCreateResourceDialog,
      };
    }

    if (spec.kind === "add-assignment") {
      return {
        label: spec.label,
        run: () => setIsAddAssignmentOpen(true),
      };
    }

    if (spec.kind === "edit-resource-url") {
      const matchingResource = resources.find(
        ({ data: resource }) => resource.name === spec.resourceName,
      )?.data;

      if (matchingResource) {
        return {
          label: spec.label,
          run: () => openEditResourceDialog(matchingResource),
        };
      }

      return {
        label: "Review resources",
        run: () => scrollToEditorSection("session-resources"),
      };
    }

    if (spec.kind === "review-resources") {
      return {
        label: spec.label,
        run: () => scrollToEditorSection("session-resources"),
      };
    }

    return {
      label: spec.label,
      run: () => scrollToEditorSection("session-assignments"),
    };
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

  const scheduledForLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(session.date));

  const publishedAtLabel = session.published_at
    ? formatUtcTimestamp(session.published_at)
    : "Not published";

  return (
    <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
      <Box
        id="sessionEditorCanvasContainer"
        className="app-canvas"
        color="white"
        maxW="1240px"
        mx="auto"
        pb={28}
      >
        <Stack id="sessionEditorMainContainer" gap={6}>
          <Flex
            id="sessionEditorHeaderContainer"
            justify="space-between"
            align="flex-start"
            gap={4}
            wrap="wrap"
          >
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
                ps={0}
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
              id="sessionEditorSubmitErrorAlert"
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
              id="sessionEditorSaveErrorAlert"
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
            id="sessionEditorContentContainer"
            align="flex-start"
            gap={6}
            direction={{ base: "column", lg: "row" }}
          >
            <Stack id="sessionEditorLeftPanel" flex="1" minW="0" gap={5}>
              <SessionDetailsPanel
                status={session.status}
                titleField={
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
                }
                dateField={
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
                }
              />

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
                    Resources
                  </Text>
                  <ResourceDialog
                    open={isAddResourceOpen}
                    onOpenChange={(open) => {
                      if (!open) {
                        setEditingResourceId(null);
                        setResourceSubmitError(null);
                        resourceForm.reset();
                      }
                      setIsAddResourceOpen(open);
                    }}
                    onOpenCreate={openCreateResourceDialog}
                    onCancel={() => {
                      setEditingResourceId(null);
                      setResourceSubmitError(null);
                      resourceForm.reset();
                      setIsAddResourceOpen(false);
                    }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void resourceForm.handleSubmit();
                    }}
                    submitError={resourceSubmitError}
                    isSubmitting={saveResourceMutation.isPending}
                    isEditing={editingResourceId !== null}
                  >
                    <resourceForm.Field name="name">
                      {(field) => (
                        <Field.Root
                          invalid={field.state.meta.errors.length > 0}
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
                          invalid={field.state.meta.errors.length > 0}
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
                          invalid={field.state.meta.errors.length > 0}
                        >
                          <Field.Label>Visibility</Field.Label>
                          <select
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(
                                event.target.value as "shared" | "individual",
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
                            <option value="individual">Individual</option>
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
                  </ResourceDialog>
                </Flex>

                <ResourceList
                  isLoading={resourcesQuery.isLoading}
                  resources={resourceItems}
                  onEdit={openEditResourceDialog}
                  onRemove={(resource) => {
                    setPendingConfirmation({
                      kind: "delete-resource",
                      id: resource.id,
                      name: resource.name,
                    });
                  }}
                />
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
                  <AssignmentDialog
                    open={isAddAssignmentOpen}
                    onOpenChange={setIsAddAssignmentOpen}
                    onCancel={() => setIsAddAssignmentOpen(false)}
                    onSubmit={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void assignmentForm.handleSubmit();
                    }}
                    submitError={assignmentSubmitError}
                    isSubmitting={createAssignmentMutation.isPending}
                  >
                    <assignmentForm.Field name="resource_id">
                      {(field) => (
                        <Field.Root
                          invalid={field.state.meta.errors.length > 0}
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
                            <option value="">Select a resource</option>
                            {resources.map(({ data: resource }) => (
                              <option key={resource.id} value={resource.id}>
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
                              field.handleChange(event.target.checked)
                            }
                          />
                          Assign to everyone
                        </label>
                      )}
                    </assignmentForm.Field>

                    {!assignmentForm.state.values.assign_to_everyone ? (
                      <assignmentForm.Field name="participant_id">
                        {(field) => (
                          <Field.Root
                            invalid={field.state.meta.errors.length > 0}
                          >
                            <Field.Label>Participant</Field.Label>
                            <select
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
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
                              <option value="">Select a participant</option>
                              {participants.map(({ data: participant }) => (
                                <option
                                  key={participant.id}
                                  value={String(participant.id)}
                                >
                                  {participant.name}
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
                    ) : null}
                  </AssignmentDialog>
                </Flex>

                <AssignmentList
                  isLoading={assignmentsQuery.isLoading}
                  assignments={assignmentItems}
                />
              </Box>

              <PublicationReadinessPanel
                isLoading={readinessQuery.isLoading}
                isError={readinessQuery.isError}
                ready={readinessQuery.data?.ready === true}
                issues={readinessQuery.data?.issues ?? []}
                onRetry={() => {
                  void readinessQuery.refetch();
                }}
                getIssueAction={getReadinessAction}
                scheduledForLabel={scheduledForLabel}
                publishedAtLabel={publishedAtLabel}
              />

              <PublicationLogPanel
                retryStatus={retryStatus}
                isLoading={publicationRecordsQuery.isLoading}
                records={publicationRecords.map(({ data: record }) => ({
                  id: record.id,
                  action: record.action,
                  status: record.status,
                  error: record.error ?? null,
                  created_at: record.created_at,
                }))}
                isRetryPending={retryPublicationMutation.isPending}
                retryPendingId={retryPublicationMutation.variables}
                onRetryRecord={(recordId) => {
                  retryPublicationMutation.mutate(recordId);
                }}
                formatTimestamp={formatUtcTimestamp}
              />
            </Stack>
          </Flex>
        </Stack>

        <FooterActionBar
          saveStatus={saveStatus}
          lastSavedAt={lastSavedAt}
          readinessIsLoading={readinessQuery.isLoading}
          readinessIsError={readinessQuery.isError}
          readinessReady={readinessQuery.data?.ready === true}
          readinessIssueCount={readinessQuery.data?.issues.length ?? 0}
          driveFolderId={session.drive_folder_id}
          isAnySavePending={isAnySavePending}
          isPrepareDrivePending={prepareDriveMutation.isPending}
          isDraftPending={draftMutation.isPending}
          isPublishPending={publishMutation.isPending}
          isPublished={Boolean(session.published_at)}
          isArchived={Boolean(session.archived_at)}
          onPrepareDrive={() => {
            const nextDate = fromDateTimeInputValue(form.state.values.date);
            if (!nextDate) {
              setSubmitError("Please choose a valid scheduled date and time.");
              return;
            }
            void prepareDriveMutation.mutateAsync({
              title: form.state.values.title.trim(),
              date: nextDate,
            });
          }}
          onSaveNow={() => {
            const nextDate = fromDateTimeInputValue(form.state.values.date);
            if (!nextDate) {
              setSubmitError("Please choose a valid scheduled date and time.");
              return;
            }

            saveCurrentDraft();
          }}
          onPublish={() => {
            const nextDate = fromDateTimeInputValue(form.state.values.date);
            if (!nextDate) {
              setSubmitError("Please choose a valid scheduled date and time.");
              return;
            }

            setPendingConfirmation({
              kind: session.published_at ? "republish" : "publish",
            });
            setMessageAppendix(
              session.published_at
                ? (session.channel_message_appendix ?? "")
                : "",
            );
            setPublishNotifications({
              channel_message: true,
              participant_dms: true,
            });
          }}
          onArchive={() => {
            setPendingConfirmation({ kind: "archive" });
          }}
        />
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
                ? "Choose which notifications to send with this update. The Drive folder will still be prepared."
                : "Choose which notifications to send now. The Drive folder will still be prepared."
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
              message_appendix: messageAppendix.trim(),
              notifications: publishNotifications,
            });
          }
        }}
      >
        {pendingConfirmation?.kind === "publish" ||
        pendingConfirmation?.kind === "republish" ? (
          <Stack gap={4}>
            <Field.Root>
              <Field.Label>Notifications to send</Field.Label>
              <Stack gap={2} mt={1}>
                <label className="assignment-toggle">
                  <input
                    type="checkbox"
                    checked={publishNotifications.channel_message}
                    onChange={(event) =>
                      setPublishNotifications((current) => ({
                        ...current,
                        channel_message: event.target.checked,
                      }))
                    }
                    disabled={publishMutation.isPending}
                  />{" "}
                  Channel message with shared resources
                </label>
                <label className="assignment-toggle">
                  <input
                    type="checkbox"
                    checked={publishNotifications.participant_dms}
                    onChange={(event) =>
                      setPublishNotifications((current) => ({
                        ...current,
                        participant_dms: event.target.checked,
                      }))
                    }
                    disabled={publishMutation.isPending}
                  />{" "}
                  Individual assignment messages
                </label>
              </Stack>
            </Field.Root>
            {publishNotifications.channel_message ? (
              <Field.Root>
                <Field.Label>Additional channel message (optional)</Field.Label>
                <Textarea
                  value={messageAppendix}
                  onChange={(event) => setMessageAppendix(event.target.value)}
                  placeholder="Add a Markdown-formatted note…"
                  rows={5}
                  maxLength={2_000}
                  disabled={publishMutation.isPending}
                />
                <Field.HelperText color="gray.400">
                  Appended to the Discord channel post. Markdown is supported.
                </Field.HelperText>
              </Field.Root>
            ) : null}
          </Stack>
        ) : null}
      </ConfirmationDialog>

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
        <LogoutErrorAlert
          id="sessionEditorLogoutErrorAlert"
          message={logoutError}
        />
      ) : null}
    </Layout>
  );
};

export default SessionEditorPage;
