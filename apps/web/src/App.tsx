import "@/App.css";
import { getStoredToken, ProtectedRoute } from "@/utils";
import { Box, Spinner, Text } from "@chakra-ui/react";
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";

const HomePage = lazy(() => import("@/pages/home"));
const LandingPage = lazy(() => import("@/pages/landing"));
const SeminarDetailPage = lazy(() => import("@/pages/seminar-detail"));
const SessionEditorPage = lazy(() => import("@/pages/session-editor"));
const SettingsPage = lazy(() => import("@/pages/settings"));

const PageFallback = () => (
  <Box
    minH="100vh"
    display="flex"
    alignItems="center"
    justifyContent="center"
    gap={3}
    role="status"
    aria-live="polite"
  >
    <Spinner color="var(--accent-soft)" />
    <Text color="gray.300">Loading page…</Text>
  </Box>
);

const RouteEffects = () => {
  const location = useLocation();

  useEffect(() => {
    const section =
      location.pathname === "/"
        ? "Admin access"
        : location.pathname === "/settings"
          ? "Settings"
          : location.pathname.includes("/sessions/")
            ? "Session editor"
            : location.pathname.startsWith("/seminars/")
              ? "Seminar"
              : "Dashboard";
    document.title = `${section} | Seminar Admin`;

    window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus({ preventScroll: true });
    });
  }, [location.pathname]);

  return null;
};

// Component ensures getStoredToken() is called fresh on each route render
const RootRoute = () => {
  const token = getStoredToken();
  return token ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <RouteEffects />
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seminars/:seminarId"
          element={
            <ProtectedRoute>
              <SeminarDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seminars/:seminarId/sessions/:sessionId"
          element={
            <ProtectedRoute>
              <SessionEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
