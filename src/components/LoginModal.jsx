import { useState } from 'react'
import { sb } from '../lib/supabase'

export default function LoginModal({ onClose, initialMode = 'choose', initialEmail = '' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState(initialEmail)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const loginGoogle = async () => {
    setBusy(true); setErr('')
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) { setErr(error.message); setBusy(false) }
  }

  const signIn = async () => {
    setBusy(true); setErr('')
    const { error } = await sb.auth.signInWithPassword({ email, password: pw })
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    else onClose()
    setBusy(false)
  }

  const signUp = async () => {
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (pw !== pw2) { setErr('Passwords do not match.'); return }
    setBusy(true); setErr('')
    const { error } = await sb.auth.signUp({ email, password: pw })
    if (error) setErr(error.message)
    else setMsg('✓ Account created! Check your email for a confirmation link, then come back and sign in below.')
    setBusy(false)
  }

  const forgotPassword = async () => {
    if (!email.trim()) { setErr('Enter your email address first.'); return }
    setBusy(true); setErr('')
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })
    if (error) setErr(error.message)
    else setMsg('✓ Password reset link sent! Check your email.')
    setBusy(false)
  }

  const goSignIn = () => { setMode('signin'); setMsg(''); setErr(''); setPw(''); setPw2('') }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 style={{ marginBottom: 16 }}>
          {mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Sign in'}
        </h2>

        {mode === 'choose' && <>
          <button className="btn full" style={{ marginBottom: 12, gap: 10, justifyContent: 'center', padding: '12px', fontSize: 14, borderColor: '#dadce0' }} onClick={loginGoogle} disabled={busy}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
            <span style={{ fontSize: 12, color: '#888' }}>or use email</span>
            <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
          </div>
          <button className="btn full" style={{ padding: '11px', fontSize: 14, marginBottom: 8 }} onClick={() => setMode('signin')}>Sign in with email</button>
          <button className="btn full" style={{ padding: '11px', fontSize: 14, background: '#f5f5f5', borderColor: '#e0e0e0' }} onClick={() => setMode('signup')}>Create new account</button>
        </>}

        {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && <>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoFocus
              onKeyDown={e => e.key === 'Enter' && mode === 'signin' && signIn()} />
          </div>
          {mode !== 'forgot' && <div className="field">
            <label>Password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && mode === 'signin' && signIn()}
              placeholder={mode === 'signup' ? 'At least 6 characters' : ''} />
          </div>}
          {mode === 'signup' && <div className="field">
            <label>Confirm password</label>
            <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && signUp()} placeholder="Repeat password" />
          </div>}
          {err && <div className="alert red">{err}</div>}
          {msg && <>
            <div className="alert green">{msg}</div>
            {mode === 'signup' && <button className="btn primary full" style={{ marginTop: 8 }} onClick={goSignIn}>Sign in now →</button>}
          </>}
          {!msg && <div className="mbtns">
            <button className="btn" onClick={() => { setMode('choose'); setErr(''); setPw(''); setPw2('') }}>← Back</button>
            {mode === 'signin' && <button className="btn primary full" onClick={signIn} disabled={busy || !email || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>}
            {mode === 'signup' && <button className="btn primary full" onClick={signUp} disabled={busy || !email || !pw || !pw2}>{busy ? 'Creating…' : 'Create account'}</button>}
            {mode === 'forgot' && <button className="btn primary full" onClick={forgotPassword} disabled={busy || !email}>{busy ? 'Sending…' : 'Send reset link'}</button>}
          </div>}
          {!msg && mode === 'signin' && <>
            <button style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: '4px' }} onClick={() => { setMode('signup'); setErr(''); setPw('') }}>No account yet? Create one →</button>
            <button style={{ width: '100%', marginTop: 2, background: 'none', border: 'none', color: '#aaa', fontSize: 12, cursor: 'pointer', padding: '4px' }} onClick={() => { setMode('forgot'); setErr(''); setPw('') }}>Forgot password?</button>
          </>}
          {!msg && mode === 'signup' && <button style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: '4px' }} onClick={goSignIn}>Already have an account? Sign in →</button>}
          {!msg && mode === 'forgot' && <button style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: '#888', fontSize: 13, cursor: 'pointer', padding: '4px' }} onClick={goSignIn}>Back to sign in</button>}
        </>}

        <button className="btn full" style={{ marginTop: 12, color: '#aaa', border: 'none', fontSize: 13 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
