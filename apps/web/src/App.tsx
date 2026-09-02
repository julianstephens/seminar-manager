import "@/App.css";
import HomePage from "@/pages/home";
import LandingPage from "@/pages/landing";
import { getStoredToken, ProtectedRoute } from "@/utils";
import { Navigate, Route, Routes } from "react-router";

function App() {
  const token = getStoredToken();

  return (
    <Routes>
      <Route
        path="/"
        element={token ? <Navigate to="/dashboard" replace /> : <LandingPage />}
      />
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
