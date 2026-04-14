import { useState, useMemo } from 'react'
import Av from './Av'
import PlayerForm from './PlayerForm'
import BulkEdit from './BulkEdit'
import { sb } from '../lib/supabase'

export default function Roster({ players, isAdmin, canDelete, onAdd, onUpdate, onDelete, groupSlug }) {
  const [modal, setModal] = useState(null)
  const [bulk, setBulk] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [invitePlayer, setInvitePlayer] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  // Link account state
  const [linkPlayer, setLinkPlayer] = useState(null)
  const [pendingProfiles, setPendingProfiles] = useState([])
  const [linkSearch, setLinkSearch] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')

  const list = useMemo(() => players.filter(p => p.name.toLowerCase().includes(q.toLowerCase())), [players, q])

  const save = async f => {
    setBusy(true)
    if (modal === 'add') await onAdd(f)
    else await onUpdate(modal.id, f)
    setBusy(false); setModal(null)
  }

  const del = async id => { if (!window.confirm('Remove this player?')) return; await onDelete(id) }

  const openLinkModal = async (player) => {
    setLinkPlayer(player)
    setLinkMsg('')
    setLinkSearch('')
    setLinkBusy(false)
    // Load pending profiles not yet linked
    const { data } = await sb.from('pending_profiles')
      .select('id,first_name,last_name,email,auth_user_id,positions,dominant_foot,photo_url')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false })
    setPendingProfiles(data || [])
  }

  const doLink = async (profile) => {
    if (!linkPlayer) return
    setLinkBusy(true); setLinkMsg('')
    // Set auth_user_id on the roster player (keep profile_complete false so they get prompted)
    const { error } = await sb.from('players').update({
      auth_user_id: profile.auth_user_id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      dominant_foot: profile.dominant_foot || null,
      positions: profile.positions || ['MID'],
      ...(profile.photo_url ? { photo_url: profile.photo_url } : {}),
    }).eq('id', linkPlayer.id)
    if (error) { setLinkMsg('Error: ' + error.message); setLinkBusy(false); return }
    // Mark pending profile as linked
    await sb.from('pending_profiles').update({ status: 'linked', reviewed_at: new Date().toISOString() }).eq('id', profile.id)
    setLinkMsg(`✓ Linked! ${profile.first_name} will be prompted to complete their profile next time they log in.`)
    setLinkBusy(false)
    // Refresh roster
    window.location.reload()
  }

  const generateInvite = () => {
    if (!inviteEmail.trim()) { setInviteMsg('Enter an email address.'); return }
    setInviteBusy(true); setInviteMsg('')
    const base = window.location.origin + '/profile'
    const params = new URLSearchParams({ invite: inviteEmail.trim().toLowerCase(), player: invitePlayer.id, group: groupSlug || 'westwood' })
    setInviteLink(`${base}?${params.toString()}`)
    setInviteMsg('Share this link via WhatsApp or Telegram.')
    setInviteBusy(false)
  }

  if (isAdmin && bulk) return <BulkEdit players={players} onUpdate={onUpdate} onClose={() => setBulk(false)} />

  return (
    <div className="section">
      <div className="hrow">
        <span className="page-title">Roster</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="count">{players.length} players</span>
          {isAdmin && <button className="btn sm" style={{ color: '#2d5509', borderColor: '#a8d87a' }} onClick={() => setBulk(true)}>✏️ Bulk edit</button>}
          {isAdmin && <button className="btn primary sm" onClick={() => setModal('add')}>+ Add</button>}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍  Search players…" /></div>
      <div className="card-wrap">
        {list.length === 0
          ? <div style={{ padding: '16px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>No players found</div>
          : list.map(p => (
            <div key={p.id} className="prow">
              <Av name={p.name} photo={p.photo_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {p.name}
                  {p.auth_user_id && <span style={{ fontSize: 9, background: '#eaf5e0', color: '#2d5509', border: '1px solid #a8d87a', borderRadius: 6, padding: '1px 5px', fontWeight: 700 }}>✓ linked</span>}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                  {isAdmin && <span className="spill">★ {p.skill}</span>}
                  {(p.positions || ['MID']).map(pos => <span key={pos} className={`ptag ${pos}`}>{pos}</span>)}
                  {p.dominant_foot && p.dominant_foot !== 'Right' && (
                    <span style={{ fontSize: 10, background: '#f0f0ff', color: '#555', border: '1px solid #ccd', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                      {p.dominant_foot === 'Left' ? '🦶L' : '🦶L/R'}
                    </span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {!p.auth_user_id && <button className="btn sm" style={{ color: '#7a4d00', borderColor: '#f0c060', fontSize: 11 }} onClick={() => openLinkModal(p)}>🔗 Link</button>}
                  {!p.auth_user_id && <button className="btn sm" style={{ color: '#1a4f80', borderColor: '#b5d4f4', fontSize: 11 }} onClick={() => { setInvitePlayer(p); setInviteEmail(''); setInviteLink(''); setInviteMsg('') }}>✉ Invite</button>}
                  <button className="btn sm" onClick={() => setModal(p)}>Edit</button>
                  {canDelete && <button className="btn sm danger" onClick={() => del(p.id)}>✕</button>}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {modal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <h2>{modal === 'add' ? 'Add player' : 'Edit — ' + modal.name}</h2>
            <PlayerForm player={modal !== 'add' ? modal : null} onSave={save} onCancel={() => setModal(null)} busy={busy} />
          </div>
        </div>
      )}

      {linkPlayer && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setLinkPlayer(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <h2>Link account — {linkPlayer.name}</h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
              Select a registered user below to link them to this roster entry. They'll be prompted to complete their profile the next time they log in.
            </p>
            <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
              placeholder="🔍 Search by name or email…" autoFocus style={{ marginBottom: 10 }} />
            {pendingProfiles.length === 0
              ? <div style={{ padding: '16px 0', textAlign: 'center', color: '#888', fontSize: 13 }}>
                  No pending registrations found. Ask the player to register first, then link here.
                </div>
              : <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 8, marginBottom: 12 }}>
                  {pendingProfiles
                    .filter(p => {
                      const name = `${p.first_name} ${p.last_name}`.toLowerCase()
                      const s = linkSearch.toLowerCase()
                      return !s || name.includes(s) || p.email?.toLowerCase().includes(s)
                    })
                    .map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }}
                        onClick={() => !linkBusy && doLink(p)}>
                        {p.photo_url
                          ? <img src={p.photo_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                          : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e8f2fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{p.first_name} {p.last_name}</div>
                          <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{p.email}</div>
                          {p.dominant_foot && <div style={{ fontSize: 11, color: '#aaa' }}>{p.dominant_foot} foot · {(p.positions || []).join('/')}</div>}
                        </div>
                        <span style={{ fontSize: 12, color: '#2d5509', fontWeight: 700, flexShrink: 0 }}>
                          {linkBusy ? '…' : '🔗 Link'}
                        </span>
                      </div>
                    ))
                  }
                </div>
            }
            {linkMsg && <div className={`alert ${linkMsg.startsWith('Error') ? 'red' : 'green'}`} style={{ marginBottom: 10 }}>{linkMsg}</div>}
            <button className="btn full" onClick={() => setLinkPlayer(null)}>Close</button>
          </div>
        </div>
      )}

      {invitePlayer && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setInvitePlayer(null)}>
          <div className="modal">
            <h2>Invite {invitePlayer.name}</h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>Enter their email address to generate a signup link. Share it via WhatsApp or Telegram. When they sign up, they'll be pre-linked to this roster entry.</p>
            <div className="field">
              <label>Their email address</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="player@email.com" autoFocus onKeyDown={e => e.key === 'Enter' && generateInvite()} />
            </div>
            <button className="btn primary full" onClick={generateInvite} disabled={inviteBusy || !inviteEmail.trim()}>Generate invite link</button>
            {inviteLink && <>
              <div style={{ fontSize: 12, wordBreak: 'break-all', background: '#f5f5f5', borderRadius: 6, padding: '8px 10px', margin: '10px 0', color: '#555' }}>{inviteLink}</div>
              <button className="btn full" onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteMsg('Copied!') }}>📋 Copy link</button>
            </>}
            {inviteMsg && <div className="alert green" style={{ marginTop: 8 }}>{inviteMsg}</div>}
            <button className="btn full" style={{ marginTop: 10, color: '#aaa', border: 'none', fontSize: 13 }} onClick={() => setInvitePlayer(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
