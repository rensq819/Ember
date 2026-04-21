import { NavLink, useLocation } from "react-router-dom";

const tabs = [
  { to: "/fast",     label: "Fast",     icon: IconFlame  },
  { to: "/log",      label: "Log",      icon: IconBook   },
  { to: "/charts",   label: "Charts",   icon: IconChart  },
  { to: "/settings", label: "Settings", icon: IconCog    },
];

export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-4 pointer-events-none"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <nav className="mx-auto max-w-md pointer-events-auto">
        <ul
          className="flex rounded-full border border-border bg-card p-1 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
        >
          {tabs.map(({ to, label, icon: Icon }) => {
            const isActive = pathname.startsWith(to);
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  className="flex items-center justify-center gap-1.5 rounded-full py-2.5 text-xs font-semibold transition-all"
                  style={isActive
                    ? { background: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }
                    : { color: 'hsl(var(--muted-foreground))' }
                  }
                >
                  <Icon />
                  {isActive && <span>{label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function IconFlame() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5c1 2 3 3 3 6a3 3 0 01-6 0c0-1 .5-2 1-3 0 1 .5 1.5 1 1.5C7 3 8 2.5 8 1.5z"/>
      <path d="M4.5 10a3.5 3.5 0 007 0"/>
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2h9v12H3a1 1 0 01-1-1V3a1 1 0 011-1zM5 5h5M5 8h5M5 11h3"/>
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14V2M2 14h12M5 11l2.5-3 2 2L13 5"/>
    </svg>
  );
}
function IconCog() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"/>
    </svg>
  );
}
