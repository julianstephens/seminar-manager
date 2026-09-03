import { Box, Button, Flex, Icon, Stack, Text } from "@chakra-ui/react";
import type { CSSProperties, PropsWithChildren } from "react";
import { useEffect, useState } from "react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuLayoutDashboard,
  LuLogOut,
  LuSettings,
} from "react-icons/lu";
import { useLocation, useNavigate } from "react-router";

const SIDEBAR_STORAGE_KEY = "seminar-admin-sidebar-open";

const navItems = [
  { label: "Dashboard", icon: LuLayoutDashboard, path: "/dashboard" },
  { label: "Settings", icon: LuSettings, path: "/settings" },
];

type LayoutProps = PropsWithChildren<{
  onLogout: () => void | Promise<void>;
  isLoggingOut: boolean;
}>;

export const Layout = ({ children, onLogout, isLoggingOut }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
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
      <Box
        as="aside"
        className="sidebar-shell"
        w={{
          base: isSidebarOpen ? "100%" : "0",
          md: sidebarWidth,
        }}
        minH={{ base: "auto", md: "100vh" }}
        bg="var(--sidebar-bg)"
        color="white"
        px={isSidebarOpen ? 4 : 0}
        py={{ base: 3, md: 4 }}
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        borderRight="1px solid"
        borderColor={isSidebarOpen ? "var(--border-soft)" : "transparent"}
        backdropFilter="blur(18px)"
        boxShadow="none"
        overflow="hidden"
        transition="all 0.3s ease"
        position={{ base: "relative", md: "sticky" }}
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
              display={{ base: "none", md: "flex" }}
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
            direction={{ base: "row", md: "column" }}
          >
            {navItems.map(({ label, icon, path }) => {
              const active = location.pathname === path;

              return (
                <Button
                  key={label}
                  className="sidebar-nav-item"
                  variant={active ? "surface" : "ghost"}
                  justifyContent={{
                    base: "center",
                    md: isSidebarOpen ? "flex-start" : "center",
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
                  _hover={{
                    bg: active
                      ? "var(--sidebar-surface-hover)"
                      : "rgba(255,255,255,0.03)",
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                  onClick={() => {
                    navigate(path);
                  }}
                  w={{ base: "full", md: isSidebarOpen ? "auto" : "44px" }}
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
          display={{ base: "none", md: "flex" }}
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
