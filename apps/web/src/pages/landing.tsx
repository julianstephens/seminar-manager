import { AUTH_TOKEN_KEY, readApiErrorMessage } from "@/utils";
import {
  Alert,
  Box,
  Button,
  Container,
  Heading,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { LoginRequest, LoginResponse } from "schemas";

const LandingPage = () => {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    defaultValues: {
      password: "",
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      setIsSubmitting(true);

      try {
        const fp = await FingerprintJS.load();
        const { visitorId } = await fp.get();

        const payload: LoginRequest = {
          client_fingerprint: visitorId,
          password: value.password,
        };

        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await readApiErrorMessage(
            response,
            "Unable to log in.",
          );
          throw new Error(message);
        }

        const data = (await response.json()) as LoginResponse;
        sessionStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
        navigate("/dashboard");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to log in.";
        setSubmitError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <Box
      as="main"
      id="main-content"
      tabIndex={-1}
      className="auth-shell"
      minH="100vh"
      bg="black"
      color="white"
    >
      <Container maxW="lg" py={{ base: 16, md: 24 }}>
        <Box
          className="auth-panel glass-panel"
          bg="transparent"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="2xl"
          p={{ base: 6, md: 8 }}
          boxShadow="0 0 0 1px rgba(255,255,255,0.04)"
        >
          <Stack gap={6}>
            <Stack gap={2}>
              <Text
                fontSize="xs"
                letterSpacing="0.22em"
                textTransform="uppercase"
                color="gray.400"
              >
                Seminar manager
              </Text>
              <Heading as="h1" size="lg" fontWeight="700">
                Admin access
              </Heading>
            </Stack>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <Stack gap={4}>
                <Box>
                  <label htmlFor="admin-password" className="field-label">
                    Password
                  </label>
                  <form.Field
                    name="password"
                    validators={{
                      onChange: ({ value }) =>
                        !value ? "Password is required." : undefined,
                    }}
                  >
                    {(field) => (
                      <>
                        <Input
                          id="admin-password"
                          type="password"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="Enter admin password"
                          autoComplete="current-password"
                          aria-invalid={field.state.meta.errors.length > 0}
                          aria-describedby={
                            field.state.meta.errors.length > 0
                              ? "password-error"
                              : undefined
                          }
                          size="lg"
                          className="glass-field"
                          bg="transparent"
                          borderColor={
                            field.state.meta.errors.length > 0
                              ? "red.400"
                              : "whiteAlpha.200"
                          }
                          _focus={{
                            borderColor: "blue.400",
                            boxShadow: "0 0 0 1px rgba(66,153,225,0.6)",
                          }}
                        />
                        {field.state.meta.errors.length > 0 ? (
                          <Text
                            id="password-error"
                            role="alert"
                            fontSize="sm"
                            color="red.300"
                            mt={2}
                          >
                            {field.state.meta.errors.join(", ")}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </form.Field>
                </Box>

                {submitError ? (
                  <Alert.Root
                    status="error"
                    bg="red.950"
                    borderColor="red.500"
                    color="red.100"
                  >
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>Authentication failed</Alert.Title>
                      <Alert.Description>{submitError}</Alert.Description>
                    </Alert.Content>
                  </Alert.Root>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  bg="var(--accent-soft)"
                  color="#111111"
                  _hover={{ bg: "var(--accent-soft-strong)" }}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Checking password..." : "Enter portal"}
                </Button>
              </Stack>
            </form>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingPage;
