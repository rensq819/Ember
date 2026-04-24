import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { syncAllData } from '@/lib/sync';

const SYNC_DONE_KEY = 'ember-cloud-synced';

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!user || syncedRef.current) return;
    if (sessionStorage.getItem(SYNC_DONE_KEY)) {
      setSyncDone(true);
      return;
    }

    syncedRef.current = true;
    setSyncing(true);

    syncAllData(user.id)
      .then(() => sessionStorage.setItem(SYNC_DONE_KEY, '1'))
      .catch(err => console.error('[ember] initial sync failed:', err))
      .finally(() => {
        setSyncing(false);
        setSyncDone(true);
      });
  }, [user?.id]);

  if (loading || (user && syncing)) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'hsl(var(--background))', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: '#C89079', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1F1C18', fontFamily: '"DM Serif Display", serif', fontSize: 24,
        }}>e</div>
        <div className="text-xs tracking-[1.8px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {loading ? 'Loading…' : 'Syncing your data…'}
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!syncDone) return null;

  return <>{children}</>;
}
