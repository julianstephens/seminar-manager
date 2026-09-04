import {
  Box,
  Button,
  CloseButton,
  Drawer,
  Flex,
  Icon,
  IconButton,
  Link,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { CSSProperties, PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuLayoutDashboard,
  LuLogOut,
  LuMenu,
  LuSettings,
} from "react-icons/lu";
import { useLocation, useNavigate } from "react-router";

const SIDEBAR_STORAGE_KEY = "seminar-admin-sidebar-open";

const navItems = [
  { label: "Dashboard", icon: LuLayoutDashboard, path: "/dashboard" },
  { label: "Settings", icon: LuSettings, path: "/settings" },
];

const isNavItemActive = (pathname: string, path: string) =>
  path === "/dashboard"
    ? pathname === "/dashboard" || pathname.startsWith("/seminars/")
    : pathname === path;

type LayoutProps = PropsWithChildren<{
  onLogout: () => void | Promise<void>;
  isLoggingOut: boolean;
}>;

export const Layout = ({ children, onLogout, isLoggingOut }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return storedValue === null ? true : storedValue === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen));
  }, [isSidebarOpen]);

  const sidebarWidth = isSidebarOpen ? "260px" : "60px";

  return (
    <Box
      minH="100vh"
      className="app-canvas"
      display="flex"
      flexDirection={{ base: "column", md: "row" }}
      color="white"
      position="relative"
      style={
        {
          "--sidebar-width": sidebarWidth,
        } as CSSProperties
      }
    >
      <Link href="#main-content" className="skip-link">
        Skip to main content
      </Link>
      <Flex
        as="header"
        display={{ base: "flex", md: "none" }}
        position="sticky"
        top={0}
        zIndex={8}
        align="center"
        justify="space-between"
        minH="64px"
        px={4}
        bg="rgba(11, 11, 12, 0.92)"
        borderBottom="1px solid"
        borderColor="var(--border-soft)"
        backdropFilter="blur(18px)"
      >
        <Flex align="center" gap={3} minW={0}>
          <Box
            w={8}
            h={8}
            flexShrink={0}
            borderRadius="md"
            bg="var(--accent-soft)"
            color="#111111"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="sm"
            fontWeight="700"
          >
            S
          </Box>
          <Text fontWeight="700" truncate>
            Seminar Admin
          </Text>
        </Flex>
        <IconButton
          aria-label="Open navigation menu"
          variant="ghost"
          color="white"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Icon as={LuMenu} boxSize={5} />
        </IconButton>
      </Flex>

      <Drawer.Root
        open={isMobileMenuOpen}
        onOpenChange={(details) => setIsMobileMenuOpen(details.open)}
        placement="start"
      >
        <Portal>
          <Drawer.Backdrop className="dialog-backdrop" />
          <Drawer.Positioner>
            <Drawer.Content
              className="sidebar-shell"
              bg="var(--sidebar-bg-strong)"
              color="white"
              maxW="300px"
            >
              <Drawer.Header px={5} py={5}>
                <Flex align="center" gap={3}>
                  <Box
                    w={8}
                    h={8}
                    borderRadius="md"
                    bg="var(--accent-soft)"
                    color="#111111"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="sm"
                    fontWeight="700"
                  >
                    S
                  </Box>
                  <Drawer.Title>Seminar Admin</Drawer.Title>
                </Flex>
                <Drawer.CloseTrigger asChild>
                  <CloseButton color="gray.300" aria-label="Close navigation" />
                </Drawer.CloseTrigger>
              </Drawer.Header>

              <Drawer.Body px={4}>
                <Stack gap={2}>
                  {navItems.map(({ label, icon, path }) => {
                    const active = isNavItemActive(location.pathname, path);
                    return (
                      <Button
                        key={label}
                        className="sidebar-nav-item"
                        variant={active ? "surface" : "ghost"}
                        justifyContent="flex-start"
                        py={3}
                        px={3}
                        borderRadius="md"
                        border="1px solid"
                        borderColor={
                          active ? "rgba(255,255,255,0.08)" : "transparent"
                        }
                        bg={active ? "var(--sidebar-surface)" : "transparent"}
                        color={active ? "white" : "var(--text-muted)"}
                        aria-current={active ? "page" : undefined}
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          navigate(path);
                        }}
                      >
                        <Icon as={icon} boxSize={4} />
                        {label}
                      </Button>
                    );
                  })}
                </Stack>
              </Drawer.Body>

              <Drawer.Footer
                px={4}
                py={5}
                borderTop="1px solid"
                borderColor="var(--border-soft)"
              >
                <Button
                  variant="ghost"
                  color="var(--text-muted)"
                  justifyContent="flex-start"
                  w="full"
                  loading={isLoggingOut}
                  disabled={isLoggingOut}
                  onClick={() => void onLogout()}
                >
                  <Icon as={LuLogOut} boxSize={4} />
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </Button>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      <Box
        as="aside"
        className="sidebar-shell"
        w={sidebarWidth}
        minH="100vh"
        bg="var(--sidebar-bg)"
        color="white"
        px={isSidebarOpen ? 4 : 0}
        py={{ base: 3, md: 4 }}
        display={{ base: "none", md: "flex" }}
        flexDirection="column"
        justifyContent="space-between"
        borderRight="1px solid"
        borderColor={isSidebarOpen ? "var(--border-soft)" : "transparent"}
        backdropFilter="blur(18px)"
        boxShadow="none"
        overflow="hidden"
        transition="all 0.3s ease"
        position="sticky"
        top={0}
        alignSelf={{ base: "stretch", md: "flex-start" }}
      >
        <Box>
          <Flex
            align="center"
            justify={isSidebarOpen ? "space-between" : "center"}
            gap={3}
            px={isSidebarOpen ? 2 : 0}
            py={2}
            mb={{ base: 3, md: isSidebarOpen ? 6 : 4 }}
          >
            {isSidebarOpen && (
              <Flex align="center" gap={3}>
                <Box
                  w={8}
                  h={8}
                  borderRadius="md"
                  bg="var(--accent-soft)"
                  color="#111111"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fontSize="sm"
                  fontWeight="700"
                >
                  S
                </Box>
                <Text fontSize="md" fontWeight="700">
                  Seminar Admin
                </Text>
              </Flex>
            )}
            <Button
              size="sm"
              variant="ghost"
              color="var(--text-muted)"
              _hover={{ bg: "whiteAlpha.50" }}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              py={isSidebarOpen ? 2 : 3}
              px={isSidebarOpen ? 2 : 1}
            >
              <Icon
                as={isSidebarOpen ? LuChevronLeft : LuChevronRight}
                boxSize={4}
              />
            </Button>
          </Flex>

          <Stack
            gap={{ base: 1, md: 2 }}
            w={isSidebarOpen ? "auto" : "60px"}
            align={isSidebarOpen ? "stretch" : "center"}
            mx={isSidebarOpen ? 0 : "auto"}
            direction="column"
          >
            {navItems.map(({ label, icon, path }) => {
              const active = isNavItemActive(location.pathname, path);

              return (
                <Button
                  key={label}
                  className="sidebar-nav-item"
                  variant={active ? "surface" : "ghost"}
                  justifyContent={{
                    base: isSidebarOpen ? "flex-start" : "center",
                  }}
                  alignItems="center"
                  py={3}
                  px={isSidebarOpen ? 3 : 2}
                  borderRadius="md"
                  border="1px solid"
                  borderColor={
                    active ? "rgba(255,255,255,0.08)" : "transparent"
                  }
                  bg={active ? "var(--sidebar-surface)" : "transparent"}
                  color={active ? "white" : "var(--text-muted)"}
                  aria-current={active ? "page" : undefined}
                  _hover={{
                    bg: active
                      ? "var(--sidebar-surface-hover)"
                      : "rgba(255,255,255,0.03)",
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                  onClick={() => {
                    navigate(path);
                  }}
                  w={isSidebarOpen ? "auto" : "44px"}
                  title={isSidebarOpen ? "" : label}
                >
                  <Icon as={icon} boxSize={4} />
                  {isSidebarOpen && label}
                </Button>
              );
            })}
          </Stack>
        </Box>

        <Flex
          display="flex"
          alignItems="center"
          justifyContent={isSidebarOpen ? "flex-start" : "center"}
          pt={4}
          borderTop="1px solid"
          borderColor="var(--border-soft)"
          w={isSidebarOpen ? "auto" : "60px"}
          mx={isSidebarOpen ? 0 : "auto"}
        >
          <Button
            size="sm"
            variant="ghost"
            color="var(--text-muted)"
            _hover={{ bg: "whiteAlpha.50" }}
            onClick={() => {
              void onLogout();
            }}
            loading={isLoggingOut}
            disabled={isLoggingOut}
            py={3}
            px={isSidebarOpen ? 3 : 2}
            w={isSidebarOpen ? "auto" : "44px"}
            title={isSidebarOpen ? "" : "Log out"}
          >
            <Icon as={LuLogOut} boxSize={4} />
            {isSidebarOpen && (isLoggingOut ? "Logging out..." : "Log out")}
          </Button>
        </Flex>
      </Box>

      <Box
        as="main"
        id="main-content"
        tabIndex={-1}
        flex="1"
        minW={0}
        px={{ base: 6, md: 10, xl: 12 }}
        py={{ base: 8, md: 10 }}
        className="app-canvas"
        overflowY="auto"
      >
        {children}
      </Box>
    </Box>
  );
};
