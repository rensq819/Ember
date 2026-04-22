import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AuthGate } from "./components/AuthGate";
import { FastRoute } from "./routes/Fast";
import { LogRoute } from "./routes/Log";
import { ChartsRoute } from "./routes/Charts";
import { SettingsRoute } from "./routes/Settings";
import { LoginRoute } from "./routes/Login";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginRoute />,
  },
  {
    path: "/",
    element: <AuthGate><AppLayout /></AuthGate>,
    children: [
      { index: true, element: <Navigate to="/fast" replace /> },
      { path: "fast", element: <FastRoute /> },
      { path: "log", element: <LogRoute /> },
      { path: "charts", element: <ChartsRoute /> },
      { path: "settings", element: <SettingsRoute /> },
    ],
  },
]);
