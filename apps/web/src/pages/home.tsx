import { CreateSeminarDialog } from "@/components/home/create-seminar-dialog";
import { DashboardHeader } from "@/components/home/dashboard-header";
import { SeminarCard } from "@/components/home/seminar-card";
import { Layout } from "@/components/layout";
import { LogoutErrorAlert } from "@/components/shared/logout-error-alert";
import {
  PageEmptyState,
  PageErrorAlert,
  PageLoadingPanel,
} from "@/components/shared/page-feedback";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  createSeminar,
  deleteSeminar,
  fetchSeminars,
  fetchSessions,
  seminarQueryKeys,
  sessionQueryKeys,
} from "@/lib/api";
import { getSessionSummary } from "@/lib/home-session-summary";
import { useLogout } from "@/lib/use-logout";
import { Field, Input, Stack, Textarea } from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { SeminarCreateSchema } from "schemas";

const HomePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logoutError, isLoggingOut, handleLogout } = useLogout(navigate);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [seminarToDelete, setSeminarToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const seminarsQuery = useQuery({
    queryKey: seminarQueryKeys.list(),
    queryFn: fetchSeminars,
  });

  const seminarSessionQueries = useQueries({
    queries:
      seminarsQuery.data?.map(({ data: seminar }) => ({
        queryKey: sessionQueryKeys.list(seminar.id),
        queryFn: () => fetchSessions(seminar.id),
        enabled: !!seminar.id,
      })) ?? [],
  });

  const seminarSummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getSessionSummary>>();

    seminarsQuery.data?.forEach(({ data: seminar }, index) => {
      const query = seminarSessionQueries[index];
      if (query?.data) {
        map.set(seminar.id, getSessionSummary(query.data));
      }
    });

    return map;
  }, [seminarSessionQueries, seminarsQuery.data]);

  const createMutation = useMutation({
    mutationFn: createSeminar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: seminarQueryKeys.all });
      form.reset();
      setSubmitError(null);
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const deleteSeminarMutation = useMutation({
    mutationFn: deleteSeminar,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: seminarQueryKeys.all });
      setSeminarToDelete(null);
    },
    onError: (error: Error) => {
      setSubmitError(error.message);
    },
  });

  const form = useForm({
    defaultValues: {
      name: "",
      description: "",
      discord_channel_id: "",
      drive_folder_id: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      const result = SeminarCreateSchema.safeParse(value);
      if (!result.success) {
        const issue = result.error.issues[0];
        setSubmitError(
          issue?.message ?? "Please complete the required seminar fields.",
        );
        return;
      }

      await createMutation.mutateAsync({
        name: result.data.name,
        description: result.data.description ?? null,
        discord_channel_id: result.data.discord_channel_id,
        drive_folder_id: result.data.drive_folder_id ?? null,
      });
    },
  });

  return (
    <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
      <DashboardHeader activeModuleCount={seminarsQuery.data?.length ?? 0} />

      <Stack id="homeSeminarsContainer" gap={4}>
        {seminarsQuery.isLoading ? (
          <PageLoadingPanel
            id="homeSeminarsLoadingState"
            message="Loading seminars…"
          />
        ) : seminarsQuery.isError ? (
          <PageErrorAlert
            id="homeSeminarsErrorState"
            title="Unable to load seminars"
            message={
              seminarsQuery.error instanceof Error
                ? seminarsQuery.error.message
                : "Unknown error"
            }
          />
        ) : seminarsQuery.data && seminarsQuery.data.length > 0 ? (
          seminarsQuery.data.map(({ data: seminar }) => (
            <SeminarCard
              key={seminar.id}
              seminar={seminar}
              plannedCount={seminarSummaries.get(seminar.id)?.planned ?? 0}
              nextSessionLabel={
                seminarSummaries.get(seminar.id)?.nextSessionLabel ??
                "Not scheduled"
              }
              isDeleting={deleteSeminarMutation.isPending}
              onDelete={() => {
                setSeminarToDelete({
                  id: seminar.id,
                  name: seminar.name,
                });
              }}
              onOpen={() => {
                navigate(`/seminars/${seminar.id}`);
              }}
            />
          ))
        ) : (
          <PageEmptyState
            id="homeSeminarsEmptyState"
            title="No seminars yet"
            description="Create your first seminar to begin organizing sessions and participants."
          />
        )}

        <ConfirmationDialog
          open={seminarToDelete !== null}
          title="Delete seminar?"
          description={`“${seminarToDelete?.name ?? "This seminar"}” and its sessions will be permanently deleted. This action cannot be undone.`}
          confirmLabel="Delete seminar"
          isPending={deleteSeminarMutation.isPending}
          onCancel={() => setSeminarToDelete(null)}
          onConfirm={() => {
            if (seminarToDelete) {
              deleteSeminarMutation.mutate(seminarToDelete.id);
            }
          }}
        />

        <CreateSeminarDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          onCancel={() => setIsCreateOpen(false)}
          submitError={submitError}
          isLoadingSeminars={seminarsQuery.isLoading}
          isSubmitting={createMutation.isPending}
        >
          <form.Field name="name">
            {(field) => (
              <Field.Root invalid={field.state.meta.errors.length > 0}>
                <Field.Label>Seminar name</Field.Label>
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Death"
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
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <Field.Root>
                <Field.Label>Description</Field.Label>
                <Textarea
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Optional seminar summary"
                  className="glass-field"
                  bg="transparent"
                  borderColor="whiteAlpha.200"
                />
              </Field.Root>
            )}
          </form.Field>

          <form.Field name="discord_channel_id">
            {(field) => (
              <Field.Root invalid={field.state.meta.errors.length > 0}>
                <Field.Label>Discord channel ID</Field.Label>
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="channel-id"
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
          </form.Field>

          <form.Field name="drive_folder_id">
            {(field) => (
              <Field.Root>
                <Field.Label>Drive folder ID</Field.Label>
                <Input
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Optional folder id"
                  className="glass-field"
                  bg="transparent"
                  borderColor="whiteAlpha.200"
                />
              </Field.Root>
            )}
          </form.Field>
        </CreateSeminarDialog>
      </Stack>

      {logoutError ? (
        <LogoutErrorAlert id="homeLogoutErrorAlert" message={logoutError} />
      ) : null}
    </Layout>
  );
};

export default HomePage;
