import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export function AppLayout() {
  return (
    <div className="flex h-full flex-col bg-background">
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(5rem + max(16px, env(safe-area-inset-bottom)))' }}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
