import { useState, useEffect } from 'react'
import Av from './Av'
import InviteLink from './InviteLink'
import { sb } from '../lib/supabase'

export default function Settings({ role, players, onClose, groupSlug, groupId }) {
  const [captains, setCaptains] = useState([])
  const [settings, setSettings] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('captains')
  const [addingFor, setAddingFor] = useState(null)
  const [emailInput, setEmailInput] = useState('')

  useEffect(() => { loadSettings() }, [groupId])

  async function loadSettings() {
    const [{ data: r }, { data: s }] = await Promise.all([
      sb.from('user_roles').select('*').eq('group_id', groupId).order('created_at'),
      sb.from('groups').select('*').eq('id', groupId).single(),
    ])
    setCaptains((r || []).filter(r => r.role === 'captain'))
    setSettings(s || { name: '', default_day: '', default_time: '', location: '', email_notifications: true })
  }

  const promotePlayer = async player => {
    if (!emailInput.trim()) { setMsg('Please enter their email address.'); return }
    setBusy(true); setMsg('')
    const email = emailInput.trim().toLowerCase()
    const { data: existing } = await sb.from('user_roles').select('id').eq('email', email).maybeSingle()
    if (existing) { setMsg('This email already has a role assigned.'); setBusy(false); return }
    const { error } = await sb.from('user_roles').insert({ email, role: 'captain', player_id: player.id, group_id: groupId })
    if (error) setMsg('Error: ' + error.message)
    else {
      setMsg(`${player.name} added as captain. They sign in with ${email}.`)
      setAddingFor(null); setEmailInput('')
      await loadSettings()
    }
    setBusy(false)
  }

  const removeCaptain = async (id, name) => {
    if (!window.confirm(`Remove captain access for ${name}?`)) return
    await sb.from('user_roles').delete().eq('id', id)
    setMsg('Captain removed.'); await loadSettings()
  }

  const saveSettings = async () => {
    setBusy(true)
    await sb.from('groups').update({
      name: settings.name,
      default_time: settings.default_time,
      location: settings.location,
      email_notifications: settings.email_notifications !== false,
    }).eq('id', groupId)
    setMsg('Saved.'); setBusy(false); setTimeout(() => setMsg(''), 3000)
  }

  const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(q.toLowerCase()))
  const captainPlayers = captains.map(c => ({ ...c, player: players.find(p => p.id === c.player_id) }))

  return (
    <div className="section">
      <div className="hrow">
        <span className="page-title">Settings</span>
        <button className="btn sm" onClick={onClose}>← Back</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['captains', '👥 Captains'], ['group', '⚙️ Group']].map(([t, l]) => (
          <button key={t} className={`btn sm${tab === t ? ' primary' : ''}`} onClick={() => setTab(t)} style={{ flex: 1, justifyContent: 'center' }}>{l}</button>
        ))}
        {settings?.donations_enabled && <button className={`btn sm${tab === 'support' ? ' primary' : ''}`} onClick={() => setTab('support')} style={{ flex: 1, justifyContent: 'center' }}>💚 Support</button>}
      </div>

      {tab === 'captains' && <>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
          Captains can edit player ratings and positions, generate and adjust teams, and record scores.
        </div>

        {captainPlayers.length > 0 && <>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>Current captains</div>
          <div className="card-wrap" style={{ marginBottom: 16 }}>
            {captainPlayers.map(c => (
              <div key={c.id} className="prow">
                <Av name={c.player ? c.player.name : c.email} size={32} photo={c.player?.photo_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.player ? c.player.name : c.email}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{c.email}</div>
                </div>
                <button className="btn sm danger" onClick={() => removeCaptain(c.id, c.player?.name || c.email)}>Remove</button>
              </div>
            ))}
          </div>
        </>}

        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>Add captain from roster</div>
        <div style={{ marginBottom: 10 }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍  Search players…" /></div>
        <div className="card-wrap">
          {filteredPlayers.map(p => {
            const isAlready = captains.some(c => c.player_id === p.id)
            const isAdding = addingFor === p.id
            return (
              <div key={p.id}>
                <div className="prow">
                  <Av name={p.name} size={32} photo={p.photo_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>{(p.positions || ['MID']).map(pos => <span key={pos} className={`ptag ${pos}`}>{pos}</span>)}</div>
                  </div>
                  {isAlready
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: '#1a4f80', background: '#e8f2fc', padding: '3px 8px', borderRadius: 8 }}>Captain ✓</span>
                    : <button className="btn sm" style={{ color: '#1a4f80', borderColor: '#b5d4f4' }} onClick={() => { setAddingFor(isAdding ? null : p.id); setEmailInput('') }}>
                      {isAdding ? 'Cancel' : '+ Captain'}
                    </button>
                  }
                </div>
                {isAdding && (
                  <div style={{ padding: '8px 0 12px 42px', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Email <b>{p.name}</b> uses to sign in:</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                        placeholder="their@email.com" onKeyDown={e => e.key === 'Enter' && promotePlayer(p)} autoFocus style={{ fontSize: 13 }} />
                      <button className="btn primary sm" onClick={() => promotePlayer(p)} disabled={busy || !emailInput.trim()}>Add</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.5px', margin: '20px 0 8px', textTransform: 'uppercase' }}>Send invite link to player</div>
        <InviteLink players={filteredPlayers} />
      </>}

      {tab === 'group' && <>
        <div className="card-wrap" style={{ padding: '14px' }}>
          <div className="field"><label>Group name</label><input value={settings?.name || ''} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} /></div>
          <div className="field"><label>Default game time</label><input type="time" value={settings?.default_time || '08:00'} onChange={e => setSettings(s => ({ ...s, default_time: e.target.value }))} /></div>
          <div className="field"><label>Location</label><input value={settings?.location || ''} onChange={e => setSettings(s => ({ ...s, location: e.target.value }))} placeholder="e.g. Westwood Fields" /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #f0f0f0', marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Email notifications</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Send emails to players when teams are published</div>
            </div>
            <div onClick={() => setSettings(s => ({ ...s, email_notifications: !s?.email_notifications }))}
              style={{ width: 44, height: 24, borderRadius: 12, background: settings?.email_notifications !== false ? '#2d5509' : '#ccc', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: settings?.email_notifications !== false ? 22 : 2, transition: 'left 0.2s' }} />
            </div>
          </div>
          <button className="btn primary full" style={{ marginTop: 14 }} onClick={saveSettings} disabled={busy}>Save</button>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.5px', marginBottom: 8, marginTop: 20, textTransform: 'uppercase' }}>Your account</div>
        <div className="card-wrap" style={{ padding: '14px' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>Signed in as admin. Only you can access settings, add captains, and delete players.</div>
          <button className="btn danger full" onClick={() => sb.auth.signOut()}>Sign out</button>
        </div>
      </>}

      {tab === 'support' && settings?.donations_enabled && <>
        <div style={{ background: '#f0faf0', border: '1px solid #a8d87a', borderRadius: 12, padding: '20px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>💚</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Support Pickup Soccer</div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
            This app is free and will stay free. A small donation helps keep it running and build new features.
          </div>
          <a href={settings?.kofi_url || 'https://ko-fi.com'} target="_blank" rel="noreferrer" style={{ display: 'inline-block', background: '#29abe0', color: '#fff', padding: '10px 24px', borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: 'none', marginBottom: 8 }}>
            ☕ Support on Ko-fi
          </a>
          <div style={{ fontSize: 11, color: '#888', marginTop: 8 }}>$10–20 one-time · No pressure</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>Ko-fi link</div>
        <div className="card-wrap" style={{ padding: '14px', marginBottom: 16 }}>
          <label>Your Ko-fi URL</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input value={settings?.kofi_url || ''} onChange={e => setSettings(s => ({ ...s, kofi_url: e.target.value }))} placeholder="https://ko-fi.com/yourname" />
            <button className="btn primary" style={{ flexShrink: 0 }} onClick={saveSettings} disabled={busy}>Save</button>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>Donor acknowledgments</div>
        <div className="card-wrap" style={{ padding: '4px 14px' }}>
          {players.map(p => (
            <div key={p.id} className="prow">
              <Av name={p.name} size={28} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
              <button className="btn sm" style={{ background: p.donor ? '#f0faf0' : 'none', borderColor: p.donor ? '#a8d87a' : '#ccc', color: p.donor ? '#2d5509' : '#888' }}
                onClick={async () => { await sb.from('players').update({ donor: !p.donor }).eq('id', p.id); window.location.reload() }}>
                {p.donor ? '💚 Donor' : 'Mark donor'}
              </button>
            </div>
          ))}
        </div>
      </>}

      {msg && <div className={`alert ${msg.startsWith('Error') ? 'red' : 'green'}`} style={{ marginTop: 12 }}>{msg}</div>}
    </div>
  )
}
