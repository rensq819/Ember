import { NavLink } from "react-router-dom";
import { Flame, LineChart, NotebookPen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/fast", label: "Fast", icon: Flame },
  { to: "/log", label: "Log", icon: NotebookPen },
  { to: "/charts", label: "Charts", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/80 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-3 text-xs transition-colors",
                  isActive ? "text-ember" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
