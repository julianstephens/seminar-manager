import { Box, Container, Heading, Link, Stack, Text } from "@chakra-ui/react";

const TermsPage = () => {
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
                Terms of Service
              </Heading>
              <Text color="gray.300">Effective date: October 8, 2026</Text>
            </Stack>

            <Stack gap={5} color="gray.200">
              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Use of the service
                </Heading>
                <Text>
                  Seminar Manager is provided as an administrative tool for
                  organizing seminars, preparing resources, and publishing
                  updates to connected services. You may use it only for lawful
                  internal seminar operations.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Administrator responsibility
                </Heading>
                <Text>
                  Administrators are responsible for the accuracy of seminar
                  data they enter, the permissions granted to connected
                  third-party services, and the content published through the
                  application.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Third-party services
                </Heading>
                <Text>
                  The service may connect to third-party providers such as
                  Google Drive and Discord. Your use of those services remains
                  subject to their own terms, policies, and availability.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Availability and changes
                </Heading>
                <Text>
                  The service is provided on an as-is basis. Features may be
                  changed, suspended, or removed at any time, including access
                  to integrations required for publishing workflows.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Limitation of liability
                </Heading>
                <Text>
                  To the maximum extent permitted by law, the service operators
                  are not liable for indirect, incidental, special, or
                  consequential damages arising from use of the application,
                  including publication failures, data loss, or third-party
                  service interruptions.
                </Text>
              </Stack>

              <Stack gap={2}>
                <Heading as="h2" size="md">
                  Contact
                </Heading>
                <Text>
                  Questions about these terms can be sent to{" "}
                  <Link href="mailto:julianstephens55@gmail.com">
                    julianstephens55@gmail.com
                  </Link>
                  .
                </Text>
              </Stack>
            </Stack>

            <Text color="gray.400" fontSize="sm">
              Read the <Link href="/privacy">privacy policy</Link> or return to
              the <Link href="/">admin portal</Link>.
            </Text>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default TermsPage;
