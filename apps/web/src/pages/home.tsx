import {
  createSeminar,
  deleteSeminar,
  fetchSeminars,
  fetchSessions,
  seminarQueryKeys,
  sessionQueryKeys,
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
  Portal,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LuChevronRight, LuTrash2 } from "react-icons/lu";
import { useNavigate } from "react-router";
import { SeminarCreateSchema, type LogoutResponse } from "schemas";

import { getSessionSummary } from "./home-session-summary";

const HomePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  return (
    <Layout onLogout={handleLogout} isLoggingOut={isLoggingOut}>
      <Flex
        align="center"
        justify="space-between"
        wrap="wrap"
        gap={3}
        mb={6}
        w="100%"
        minW={0}
      >
        <Heading
          as="h1"
          size="2xl"
          fontWeight="700"
          color="white"
          flex="1 1 220px"
          minW={0}
        >
          Dashboard
        </Heading>
        <Text
          fontSize="sm"
          color="gray.400"
          whiteSpace="nowrap"
          flex="0 1 auto"
          minW={0}
          textAlign="right"
        >
          {seminarsQuery.data?.length ?? 0} active modules
        </Text>
      </Flex>

      <Stack gap={4}>
        {seminarsQuery.isLoading ? (
          <Box
            borderRadius="xl"
            border="1px solid"
            borderColor="var(--border-soft)"
            bg="var(--panel-elevated)"
            px={5}
            py={4}
          >
            <Text color="gray.300">Loading seminars…</Text>
          </Box>
        ) : seminarsQuery.isError ? (
          <Alert.Root
            status="error"
            bg="red.950"
            borderColor="red.500"
            color="red.100"
          >
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Unable to load seminars</Alert.Title>
              <Alert.Description>
                {seminarsQuery.error instanceof Error
                  ? seminarsQuery.error.message
                  : "Unknown error"}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        ) : seminarsQuery.data && seminarsQuery.data.length > 0 ? (
          seminarsQuery.data.map(({ data: seminar }) => (
            <Box
              key={seminar.id}
              borderRadius="xl"
              border="1px solid"
              borderColor="var(--border-soft)"
              bg="var(--panel-elevated)"
              px={5}
              py={4}
              boxShadow="0 0 0 1px rgba(255,255,255,0.02)"
            >
              <Flex align="center" justify="space-between" gap={6} wrap="wrap">
                <Box flex="1" minW="260px">
                  <Heading
                    as="h2"
                    fontSize="2xl"
                    fontWeight="700"
                    color="white"
                    lineHeight="1.2"
                    mb={2}
                  >
                    {seminar.name}
                  </Heading>
                  <Text fontSize="sm" color="gray.300" lineHeight="1.6">
                    {seminar.description ?? "No description provided."}
                  </Text>
                </Box>

                <Flex align="center" gap={6} ml="auto">
                  <Stack align="flex-end" gap={1} minW="120px">
                    <Text
                      fontSize="xs"
                      letterSpacing="0.12em"
                      textTransform="uppercase"
                      color="gray.400"
                    >
                      Sessions
                    </Text>
                    <Text fontWeight="700" fontSize="lg" color="white">
                      {seminarSummaries.get(seminar.id)?.planned ?? 0} planned
                    </Text>
                  </Stack>

                  <Stack align="flex-end" gap={1} minW="180px">
                    <Text
                      fontSize="xs"
                      letterSpacing="0.12em"
                      textTransform="uppercase"
                      color="gray.400"
                    >
                      Next session
                    </Text>
                    <Text fontWeight="700" fontSize="md" color="white">
                      {seminarSummaries.get(seminar.id)?.nextSessionLabel ??
                        "Not scheduled"}
                    </Text>
                  </Stack>

                  <Flex align="center" gap={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      borderColor="red.400"
                      color="red.300"
                      _hover={{ bg: "red.950" }}
                      loading={deleteSeminarMutation.isPending}
                      disabled={deleteSeminarMutation.isPending}
                      onClick={() => {
                        void deleteSeminarMutation.mutateAsync(seminar.id);
                      }}
                    >
                      <Icon as={LuTrash2} boxSize={4} />
                      Delete
                    </Button>
                    <IconButton
                      aria-label={`Open ${seminar.name}`}
                      variant="ghost"
                      borderRadius="full"
                      color="gray.300"
                      _hover={{ bg: "whiteAlpha.100" }}
                      onClick={() => {
                        navigate(`/seminars/${seminar.id}`);
                      }}
                    >
                      <Icon as={LuChevronRight} boxSize={5} />
                    </IconButton>
                  </Flex>
                </Flex>
              </Flex>
            </Box>
          ))
        ) : (
          <Box
            borderRadius="xl"
            border="1px dashed"
            borderColor="var(--border-soft)"
            bg="var(--panel-elevated)"
            px={5}
            py={8}
            boxShadow="inset 0 1px 0 rgba(255,255,255,0.02)"
          >
            <Stack gap={3} align="center">
              <Heading as="h2" size="lg" color="white">
                No seminars yet
              </Heading>
            </Stack>
          </Box>
        )}

        <Dialog.Root
          open={isCreateOpen}
          onOpenChange={(details) => setIsCreateOpen(details.open)}
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
                    New seminar
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
                    id="seminar-create-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void form.handleSubmit();
                    }}
                  >
                    <Stack gap={4}>
                      <form.Field name="name">
                        {(field) => (
                          <Field.Root
                            invalid={field.state.meta.errors.length > 0}
                          >
                            <Field.Label>Seminar name</Field.Label>
                            <Input
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              placeholder="Death"
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
                      </form.Field>

                      <form.Field name="description">
                        {(field) => (
                          <Field.Root>
                            <Field.Label>Description</Field.Label>
                            <Textarea
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              placeholder="Optional seminar summary"
                              bg="black"
                              borderColor="whiteAlpha.200"
                            />
                          </Field.Root>
                        )}
                      </form.Field>

                      <form.Field name="discord_channel_id">
                        {(field) => (
                          <Field.Root
                            invalid={field.state.meta.errors.length > 0}
                          >
                            <Field.Label>Discord channel ID</Field.Label>
                            <Input
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              placeholder="channel-id"
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
                      </form.Field>

                      <form.Field name="drive_folder_id">
                        {(field) => (
                          <Field.Root>
                            <Field.Label>Drive folder ID</Field.Label>
                            <Input
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              placeholder="Optional folder id"
                              bg="black"
                              borderColor="whiteAlpha.200"
                            />
                          </Field.Root>
                        )}
                      </form.Field>

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

                      {seminarsQuery.isLoading ? (
                        <Text color="gray.300">Loading seminar details…</Text>
                      ) : null}
                    </Stack>
                  </form>
                </Dialog.Body>

                <Dialog.Footer px={6} pb={6} pt={0}>
                  <Button
                    variant="ghost"
                    color="gray.300"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="seminar-create-form"
                    bg="white"
                    color="black"
                    _hover={{ bg: "gray.200" }}
                    loading={createMutation.isPending}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending
                      ? "Creating..."
                      : "Create seminar"}
                  </Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      </Stack>

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

export default HomePage;
