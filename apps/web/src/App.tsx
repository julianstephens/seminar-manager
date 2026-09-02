import "@/App.css";
import HomePage from "@/pages/home";
import LandingPage from "@/pages/landing";
import { getStoredToken, ProtectedRoute } from "@/utils";
import { Navigate, Route, Routes } from "react-router";

// Component ensures getStoredToken() is called fresh on each route render
const RootRoute = () => {
  const token = getStoredToken();
  return token ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

function App() {
  return (
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
