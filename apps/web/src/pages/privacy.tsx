import { Box, Container, Heading, Link, Stack, Text } from "@chakra-ui/react";

const PrivacyPage = () => {
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
      <Container maxW="3xl" py={{ base: 16, md: 24 }}>
        <Box
          className="auth-panel glass-panel"
          bg="transparent"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="2xl"
          p={{ base: 6, md: 8 }}
          boxShadow="0 0 0 1px rgba(255,255,255,0.04)"
        >
          <Stack gap={8}>
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
                Privacy Policy
              </Heading>
              <Text color="gray.300">Effective date: October 8, 2026</Text>
            </Stack>

            <Stack gap={5} color="gray.200">
              <Stack gap={2}>
                <Heading as="h2" size="md">
                  What this app does
                </Heading>
                <Text>
                  Seminar Manager is an internal administration tool for
                  planning seminars, preparing session materials, and publishing
                  updates to connected services.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Google Drive data we access
                </Heading>
                <Text>
                  When Google Drive is connected, the application uses Google
                  OAuth credentials for the administrator account to create,
                  read, and organize seminar folders and session folders in that
                  account&apos;s Drive.
                </Text>
                <Text>
                  The application is intended to use the
                  https://www.googleapis.com/auth/drive.file scope so it can
                  work with folders and files created or selected for the
                  seminar workflow.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  How the data is used
                </Heading>
                <Text>
                  Google Drive access is used only to support publishing
                  features, including creating the seminars folder structure,
                  reusing existing Drive folders, and storing folder references
                  needed by the app.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Sharing and retention
                </Heading>
                <Text>
                  Seminar Manager does not sell Google Drive data. Data is only
                  used to operate the service and is disclosed only when
                  required by law or necessary to provide the service.
                </Text>
                <Text>
                  Seminar metadata and linked Drive folder identifiers may be
                  retained as long as needed to operate the seminar workflow or
                  maintain publication records.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Revoking access
                </Heading>
                <Text>
                  Administrators can revoke Google access at any time from their
                  Google account permissions page. After access is revoked,
                  Google Drive publishing features will stop working until new
                  credentials are configured.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Contact
                </Heading>
                <Text>Contact: julianstephens55@gmail.com</Text>
              </Stack>
            </Stack>

            <Text color="gray.400" fontSize="sm">
              Read the <Link href="/terms">terms of service</Link> or return to
              the <Link href="/">admin portal</Link>.
            </Text>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default PrivacyPage;
