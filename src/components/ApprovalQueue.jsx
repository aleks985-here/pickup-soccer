import { useState, useEffect } from 'react'
import { sb, logActivity } from '../lib/supabase'

export default function ApprovalQueue({ onClose, players, onApproved, groupId }) {
  const [pending, setPending] = useState([])
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const [linkingFor, setLinkingFor] = useState(null) // profile id being linked
  const [linkSearch, setLinkSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await sb.from('pending_profiles')
      .select('*')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
    setPending(data || [])
  }

  const approve = async (p, linkToId) => {
    setBusy(p.id); setMsg('')
    const fullName = `${p.first_name} ${p.last_name}`.trim()
    if (linkToId) {
      const { error } = await sb.from('players').update({
        auth_user_id: p.auth_user_id,
        linked_at: new Date().toISOString(),
        name: fullName,
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.date_of_birth,
        is_minor: p.is_minor,
        city: p.city,
        dominant_foot: p.dominant_foot,
        positions: p.positions,
        years_played: p.years_played,
        league_experience: p.league_experience,
        player_notes: p.player_notes,
        profile_complete: true,
        ...(p.photo_url ? { photo_url: p.photo_url } : {}),
      }).eq('id', linkToId)
      if (!error) {
        await sb.from('pending_profiles').update({ status: 'linked', reviewed_at: new Date().toISOString() }).eq('id', p.id)
        setPending(prev => prev.filter(x => x.id !== p.id))
        logActivity({ action: 'profile_linked', playerName: fullName, groupId, notes: p.email })
        setLinkingFor(null); setLinkSearch('')
        onApproved(); setMsg(`✓ ${fullName} linked to roster`)
      } else setMsg('Error: ' + error.message)
    } else {
      const { error } = await sb.from('players').insert({
        name: fullName,
        skill: 5,
        positions: p.positions || ['MID'],
        auth_user_id: p.auth_user_id,
        linked_at: new Date().toISOString(),
        first_name: p.first_name,
        last_name: p.last_name,
        date_of_birth: p.date_of_birth,
        is_minor: p.is_minor,
        city: p.city,
        dominant_foot: p.dominant_foot,
        years_played: p.years_played,
        league_experience: p.league_experience,
        player_notes: p.player_notes,
        profile_complete: true,
        ...(p.photo_url ? { photo_url: p.photo_url } : {}),
      })
      if (!error) {
        await sb.from('pending_profiles').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', p.id)
        setPending(prev => prev.filter(x => x.id !== p.id))
        logActivity({ action: 'profile_approved', playerName: fullName, groupId, notes: p.email })
        onApproved(); setMsg(`✓ ${fullName} added to roster as new player`)
      } else setMsg('Error: ' + error.message)
    }
    setBusy(null)
  }

  const reject = async p => {
    const reason = prompt('Reason for rejection (optional):')
    if (reason === null) return // cancelled
    setBusy(p.id)
    await sb.from('pending_profiles').update({ status: 'rejected', rejection_reason: reason || 'Not approved.', reviewed_at: new Date().toISOString() }).eq('id', p.id)
    setPending(prev => prev.filter(x => x.id !== p.id))
    logActivity({ action: 'profile_rejected', playerName: `${p.first_name} ${p.last_name}`, groupId, notes: reason || p.email })
    setBusy(null); setMsg('Rejected ✓')
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>New player requests ({pending.length})</h2>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>

        {msg && <div className="alert green" style={{ marginBottom: 12 }}>{msg}</div>}

        {pending.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>No pending requests</p>
        )}

        {pending.map(p => {
          const sug = p.suggested_player_id ? players.find(pl => pl.id === p.suggested_player_id) : null
          const isLinking = linkingFor === p.id
          const filteredPlayers = players.filter(pl => {
            if (!linkSearch.trim()) return true
            return pl.name.toLowerCase().includes(linkSearch.toLowerCase())
          })

          return (
            <div key={p.id} style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: 14, marginBottom: 12, background: '#fafafa' }}>
              {/* Player info */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                {p.photo_url
                  ? <img src={p.photo_url} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                  : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e8f2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👤</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{p.email}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                    {p.city && `${p.city} · `}{p.dominant_foot && `${p.dominant_foot} foot · `}{(p.positions || []).join('/')}
                  </div>
                </div>
                {p.status === 'approved' && (
                  <span style={{ fontSize: 10, background: '#fff5e0', color: '#7a4d00', border: '1px solid #f0c060', borderRadius: 6, padding: '2px 7px', fontWeight: 700, height: 'fit-content' }}>
                    REGISTERED
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12, color: '#555', marginBottom: 8, lineHeight: 1.8 }}>
                {p.years_played && <span style={{ marginRight: 12 }}>⏱ {p.years_played} yrs</span>}
                {p.league_experience && <span style={{ marginRight: 12 }}>🏆 {p.league_experience}</span>}
                {p.is_minor && <span style={{ color: '#e07b5a', fontWeight: 600 }}>⚠ Minor</span>}
              </div>

              {p.player_notes && (
                <div style={{ fontSize: 12, color: '#666', background: '#f5f5f5', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontStyle: 'italic' }}>
                  "{p.player_notes}"
                </div>
              )}

              {/* Suggested match */}
              {sug && (
                <div style={{ fontSize: 12, background: '#eaf5e0', border: '1px solid #a8d87a', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                  Claims to be: <strong>{sug.name}</strong> in the roster
                </div>
              )}

              {/* Link to roster search */}
              {isLinking && (
                <div style={{ marginBottom: 10, border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 10px', background: '#f5f5f5', borderBottom: '1px solid #e0e0e0', fontSize: 12, fontWeight: 600, color: '#555' }}>
                    Search roster to link:
                  </div>
                  <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                    placeholder="🔍 Type player name…" autoFocus
                    style={{ width: '100%', padding: '8px 10px', border: 'none', borderBottom: '1px solid #e0e0e0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {filteredPlayers.slice(0, 15).map(pl => (
                      <div key={pl.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: '#fff' }}
                        onClick={() => approve(p, pl.id)}>
                        <span style={{ flex: 1, fontSize: 13 }}>{pl.name}</span>
                        {!pl.auth_user_id
                          ? <span style={{ fontSize: 11, color: '#2d5509', fontWeight: 700 }}>🔗 Link</span>
                          : <span style={{ fontSize: 11, color: '#aaa' }}>already linked</span>
                        }
                      </div>
                    ))}
                    {filteredPlayers.length === 0 && (
                      <div style={{ padding: '10px', fontSize: 13, color: '#aaa' }}>No players found</div>
                    )}
                  </div>
                  <div style={{ padding: '6px 8px', background: '#fafafa' }}>
                    <button className="btn sm full" onClick={() => { setLinkingFor(null); setLinkSearch('') }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!isLinking && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sug && (
                    <button className="btn primary" style={{ fontSize: 12, padding: '6px 12px' }}
                      disabled={busy === p.id}
                      onClick={() => approve(p, p.suggested_player_id)}>
                      🔗 Link to {sug.name}
                    </button>
                  )}
                  <button className="btn" style={{ fontSize: 12, padding: '6px 12px', color: '#1a4f80', borderColor: '#b5d4f4' }}
                    disabled={busy === p.id}
                    onClick={() => { setLinkingFor(p.id); setLinkSearch('') }}>
                    🔍 Link to roster…
                  </button>
                  <button className="btn" style={{ fontSize: 12, padding: '6px 12px', background: '#eaf5e0', borderColor: '#a8d87a', color: '#2a5c0e' }}
                    disabled={busy === p.id}
                    onClick={() => approve(p, null)}>
                    ✓ Add as new
                  </button>
                  <button className="btn danger" style={{ fontSize: 12, padding: '6px 12px' }}
                    disabled={busy === p.id}
                    onClick={() => reject(p)}>
                    ✕ Reject
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
