import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { FastRoute } from "./routes/Fast";
import { LogRoute } from "./routes/Log";
import { ChartsRoute } from "./routes/Charts";
import { SettingsRoute } from "./routes/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/fast" replace /> },
      { path: "fast", element: <FastRoute /> },
      { path: "log", element: <LogRoute /> },
      { path: "charts", element: <ChartsRoute /> },
      { path: "settings", element: <SettingsRoute /> },
    ],
  },
]);
