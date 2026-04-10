import { useState } from 'react'
import { sb } from '../lib/supabase'

export default function InviteLink({ players }) {
  const [selectedId, setSelectedId] = useState('')
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const generate = async () => {
    if (!email.trim()) { setMsg('Enter an email address.'); return }
    setBusy(true); setMsg(''); setLink('')
    const { data, error } = await sb.auth.admin?.generateLink?.({
      type: 'magiclink',
      email: email.trim().toLowerCase(),
    }).catch(() => ({ error: { message: 'Admin API not available in browser' } }))
    if (error) {
      const inviteUrl = `${window.location.origin}/profile?invite=${encodeURIComponent(email.trim().toLowerCase())}&player=${selectedId}`
      setLink(inviteUrl)
      setMsg('Share this link with the player. They sign up and link to their roster profile.')
    } else if (data?.properties?.action_link) {
      setLink(data.properties.action_link)
      setMsg('Magic link generated. Share with the player — expires in 1 hour.')
    }
    setBusy(false)
  }

  const copy = () => { navigator.clipboard.writeText(link); setMsg('Link copied!') }

  return (
    <div className="card-wrap" style={{ padding: 14, marginBottom: 8 }}>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 10, lineHeight: 1.5 }}>
        Select a player from the roster and enter their email to generate a profile setup link. Share via WhatsApp or Telegram.
      </div>
      <div className="field">
        <label>Roster player (optional)</label>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          <option value="">New player — not in roster yet</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Their email address *</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@email.com" />
      </div>
      <button className="btn primary full" onClick={generate} disabled={busy || !email.trim()}>{busy ? 'Generating…' : 'Generate invite link'}</button>
      {link && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, wordBreak: 'break-all', background: '#f5f5f5', borderRadius: 6, padding: '8px 10px', marginBottom: 6, color: '#555' }}>{link}</div>
          <button className="btn full" onClick={copy} style={{ fontSize: 13 }}>📋 Copy link</button>
        </div>
      )}
      {msg && <div className={`alert ${msg.startsWith('Error') || msg.startsWith('Enter') ? 'red' : 'green'}`} style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
