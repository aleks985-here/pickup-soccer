import { useState, useEffect } from 'react'
import { sb, logActivity } from '../lib/supabase'

export default function ApprovalQueue({ onClose, players, onApproved, groupId }) {
  const [pending, setPending] = useState([])
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    sb.from('pending_profiles').select('*').eq('status', 'pending').order('created_at').then(({ data }) => setPending(data || []))
  }, [])

  const approve = async (p, linkToId) => {
    setBusy(p.id); setMsg('')
    if (linkToId) {
      const { error } = await sb.from('players').update({
        auth_user_id: p.auth_user_id, linked_at: new Date().toISOString(),
        first_name: p.first_name, last_name: p.last_name, date_of_birth: p.date_of_birth,
        is_minor: p.is_minor, city: p.city, dominant_foot: p.dominant_foot,
        positions: p.positions, years_played: p.years_played, league_experience: p.league_experience,
        player_notes: p.player_notes, profile_complete: true,
        ...(p.photo_url ? { photo_url: p.photo_url } : {}),
      }).eq('id', linkToId)
      if (!error) {
        await sb.from('pending_profiles').update({ status: 'linked', reviewed_at: new Date().toISOString() }).eq('id', p.id)
        setPending(prev => prev.filter(x => x.id !== p.id))
        logActivity({ action: 'profile_linked', playerName: `${p.first_name} ${p.last_name}`, groupId, notes: p.email })
        onApproved(); setMsg('Linked to existing player ✓')
      } else setMsg('Error: ' + error.message)
    } else {
      const name = `${p.first_name} ${p.last_name.charAt(0)}.`
      const { error } = await sb.from('players').insert({
        name, skill: 5, positions: p.positions || ['MID'],
        auth_user_id: p.auth_user_id, linked_at: new Date().toISOString(),
        first_name: p.first_name, last_name: p.last_name, date_of_birth: p.date_of_birth,
        is_minor: p.is_minor, city: p.city, dominant_foot: p.dominant_foot,
        years_played: p.years_played, league_experience: p.league_experience,
        player_notes: p.player_notes, profile_complete: true,
        ...(p.photo_url ? { photo_url: p.photo_url } : {}),
      })
      if (!error) {
        await sb.from('pending_profiles').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', p.id)
        setPending(prev => prev.filter(x => x.id !== p.id))
        logActivity({ action: 'profile_approved', playerName: `${p.first_name} ${p.last_name}`, groupId, notes: p.email })
        onApproved(); setMsg('Added to roster as new player ✓')
      } else setMsg('Error: ' + error.message)
    }
    setBusy(null)
  }

  const reject = async p => {
    const reason = prompt('Reason for rejection (optional):')
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
        {pending.length === 0 && <p style={{ color: '#888', textAlign: 'center', padding: '20px 0' }}>No pending requests</p>}
        {pending.map(p => {
          const sug = p.suggested_player_id ? players.find(pl => pl.id === p.suggested_player_id) : null
          return (
            <div key={p.id} style={{ border: '1px solid #e0e0e0', borderRadius: 10, padding: 14, marginBottom: 12, background: '#fafafa' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                {p.photo_url && <img src={p.photo_url} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} alt="" />}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{p.email}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{p.city} · {p.dominant_foot} foot · {(p.positions || []).join('/')}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 8, lineHeight: 1.8 }}>
                <span style={{ marginRight: 12 }}>⏱ {p.years_played} yrs</span>
                <span style={{ marginRight: 12 }}>🏆 {p.league_experience}</span>
                {p.is_minor && <span style={{ color: '#e07b5a', fontWeight: 600 }}>⚠ Minor</span>}
              </div>
              {p.player_notes && <div style={{ fontSize: 12, color: '#666', background: '#f5f5f5', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontStyle: 'italic' }}>"{p.player_notes}"</div>}
              {sug && <div style={{ fontSize: 12, background: '#eaf5e0', border: '1px solid #a8d87a', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                Claims to be: <strong>{sug.name}</strong> in the roster
              </div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sug && <button className="btn primary" style={{ fontSize: 12, padding: '6px 12px' }} disabled={busy === p.id} onClick={() => approve(p, p.suggested_player_id)}>🔗 Link to {sug.name}</button>}
                <button className="btn" style={{ fontSize: 12, padding: '6px 12px', background: '#eaf5e0', borderColor: '#a8d87a', color: '#2a5c0e' }} disabled={busy === p.id} onClick={() => approve(p, null)}>✓ Add as new</button>
                <button className="btn danger" style={{ fontSize: 12, padding: '6px 12px' }} disabled={busy === p.id} onClick={() => reject(p)}>✕ Reject</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
