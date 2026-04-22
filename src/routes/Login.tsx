import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function LoginRoute() {
  const { user, loading, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);
    const { error } = await signInWithMagicLink(email.trim());
    setSending(false);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'hsl(var(--background))', padding: '24px',
    }}>
      {/* Ember logo */}
      <div style={{
        width: 52, height: 52, borderRadius: 15,
        background: '#C89079', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1F1C18', fontFamily: '"DM Serif Display", serif', fontSize: 30,
        marginBottom: 28,
        boxShadow: '0 8px 24px -8px rgba(200,144,121,0.5)',
      }}>e</div>

      <h1 className="font-display" style={{ fontSize: 38, letterSpacing: -1, lineHeight: 1.05, textAlign: 'center', marginBottom: 10 }}>
        {sent ? <>Check your<br /><em style={{ color: '#C89079' }}>email.</em></> : <>Welcome to<br /><em style={{ color: '#C89079' }}>Ember.</em></>}
      </h1>

      {sent ? (
        <>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 1.6, marginBottom: 32 }}>
            We sent a sign-in link to <strong style={{ color: 'hsl(var(--foreground))' }}>{email}</strong>. Click it to access your data.
          </p>
          <button
            onClick={() => { setSent(false); setEmail(''); }}
            style={{
              fontSize: 13, color: 'hsl(var(--muted-foreground))',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: '"Geist", system-ui, sans-serif',
            }}
          >
            Use a different email
          </button>
        </>
      ) : (
        <>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 14, textAlign: 'center', maxWidth: 270, lineHeight: 1.6, marginBottom: 36 }}>
            Enter your email and we'll send you a sign-in link — no password needed.
          </p>

          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 14,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                color: 'hsl(var(--foreground))',
                fontSize: 15, outline: 'none',
                fontFamily: '"Geist", system-ui, sans-serif',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={sending || !email.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(180deg, #D4A48E 0%, #C89079 100%)',
                color: '#1F1C18', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                fontFamily: '"Geist", system-ui, sans-serif',
                opacity: (sending || !email.trim()) ? 0.65 : 1,
                boxShadow: '0 6px 20px -8px #C89079',
              }}
            >
              {sending ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>

          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 12, fontSize: 13,
              border: '1px solid rgba(185,122,99,0.4)',
              background: 'rgba(185,122,99,0.08)',
              color: '#B97A63', maxWidth: 320, width: '100%', textAlign: 'center',
            }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
