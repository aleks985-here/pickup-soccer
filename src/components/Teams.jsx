import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Av from './Av'
import { LABELS } from '../lib/constants'
import { genTeams } from '../lib/utils'
import { sb, sendEmail, sendTelegram } from '../lib/supabase'

// ─── Sub modal ────────────────────────────────────────────────────────────────
function SubModal({ player, teamIdx, teams, bench, onSub, onClose, isAdmin }) {
  const [tab, setTab] = useState('bench')
  const opts = tab === 'bench' ? bench : teams.flatMap((t, ti) => ti === teamIdx ? [] : t.map(p => ({ ...p, _ft: ti })))
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Substitute {player.name}</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button className={`btn sm${tab === 'bench' ? ' primary' : ''}`} onClick={() => setTab('bench')}>Bench ({bench.length})</button>
          <button className={`btn sm${tab === 'swap' ? ' primary' : ''}`} onClick={() => setTab('swap')}>Swap teams</button>
        </div>
        {opts.length === 0
          ? <p style={{ color: '#888', fontSize: 14, padding: '8px 0' }}>No players available</p>
          : opts.map(sub => (
            <div key={sub.id} className="prow" style={{ cursor: 'pointer' }} onClick={() => onSub(player, teamIdx, sub, tab === 'swap' ? sub._ft : null)}>
              <Av name={sub.name} size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{sub.name}{tab === 'swap' && <span style={{ fontSize: 11, color: '#888' }}> from Team {LABELS[sub._ft]}</span>}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  {isAdmin && <span className="spill">★{sub.skill}</span>}
                  {(sub.positions || ['MID']).slice(0, 2).map(p => <span key={p} className={`ptag ${p}`}>{p}</span>)}
                </div>
              </div>
              <button className="btn sm primary">Sub in</button>
            </div>
          ))
        }
        <div className="mbtns"><button className="btn full" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  )
}

// ─── Viewer (non-admin) ───────────────────────────────────────────────────────
function ViewerGame({ games }) {
  const latest = games && games[0]
  if (!latest) return (
    <div className="section">
      <div className="hrow"><span className="page-title">Next game</span></div>
      <div className="empty"><div className="icon">⚽</div><div className="title">No teams yet</div><p style={{ fontSize: 14 }}>Check back closer to game day.</p></div>
    </div>
  )
  const getName = p => typeof p === 'string' ? p : p.name
  const getPos = p => typeof p === 'string' ? [] : p.positions || []
  const isGuest = p => typeof p !== 'string' && p.isGuest
  return (
    <div className="section">
      <div className="hrow"><span className="page-title">Latest game</span><span className="count">{latest.player_count} players</span></div>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: '#2d5509' }}>📅 {latest.game_date}</span>
        <span style={{ color: '#888', marginLeft: 8 }}>{latest.team_count} teams · {latest.player_count} players</span>
      </div>
      {(latest.teams || []).map((t, ti) => (
        <div key={ti} className={`tbox t${ti}`}>
          <div className="ttitle">
            <span>TEAM {LABELS[ti]}</span>
            {latest.scores && latest.scores[ti] !== undefined && latest.scores[ti] !== 0 && <span style={{ fontSize: 18, fontWeight: 700 }}>{latest.scores[ti]}</span>}
          </div>
          {t.map((p, i) => (
            <div key={i} className="tplayer">
              <Av name={getName(p)} size={26} photo={p.photo_url} />
              <span style={{ flex: 1, fontWeight: 500 }}>
                {getName(p)}
                {isGuest(p) && <span style={{ fontSize: 10, background: '#fef6e4', color: '#7a4d00', border: '1px solid #f0c060', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700 }}>GUEST</span>}
              </span>
              <div style={{ display: 'flex', gap: 3 }}>{getPos(p).map(pos => <span key={pos} className={`ptag ${pos}`}>{pos}</span>)}</div>
            </div>
          ))}
        </div>
      ))}
      {latest.subs && latest.subs.length > 0 && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>🔄 {latest.subs.map((s, i) => `${s.out}→${s.in}`).join(', ')}</div>}
    </div>
  )
}

// ─── Main Teams component ─────────────────────────────────────────────────────
export default function Teams({ players, onSaveGame, isAdmin, games, groupId, groupSlug }) {
  // step: 'mode' | 'attend' | 'teams' | 'rsvp-form' | 'rsvp-live'
  const [step, setStep] = useState(isAdmin ? 'mode' : null)
  const [attending, setAttending] = useState([])
  const [guests, setGuests] = useState({})
  const [teams, setTeams] = useState(null)
  const [n, setN] = useState(2)
  const [scores, setScores] = useState({})
  const [saved, setSaved] = useState(false)
  const [subModal, setSubModal] = useState(null)
  const [subs, setSubs] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [presentPlayers, setPresentPlayers] = useState([])

  // Game date defaults to next Sunday
  const [gameDate, setGameDate] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const daysUntilSunday = day === 0 ? 7 : 7 - day
    d.setDate(d.getDate() + daysUntilSunday)
    return d.toISOString().slice(0, 10)
  })
  const [gameTime, setGameTime] = useState('08:00')

  // RSVP mode state
  const [rsvpDate, setRsvpDate] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const daysUntilSunday = day === 0 ? 7 : 7 - day
    d.setDate(d.getDate() + daysUntilSunday)
    return d.toISOString().slice(0, 10)
  })
  const [rsvpTime, setRsvpTime] = useState('08:00')
  const [rsvpLocation, setRsvpLocation] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [sendInviteEmails, setSendInviteEmails] = useState(true)
  const [rsvpGameId, setRsvpGameId] = useState(null)
  const [rsvpData, setRsvpData] = useState([]) // loaded from DB
  const [rsvpGame, setRsvpGame] = useState(null)
  const [creatingRsvp, setCreatingRsvp] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Open RSVP games (from games prop)
  const openRsvpGames = useMemo(() => (games || []).filter(g => g.rsvp_open), [games])

  const tog = id => setAttending(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id])
  const addGuest = id => setGuests(g => ({ ...g, [id]: Math.min((g[id] || 0) + 1, 3) }))
  const removeGuest = id => setGuests(g => { const n = { ...g }; if (n[id] > 1) n[id]--; else delete n[id]; return n })

  const buildPresent = () => {
    const base = players.filter(p => attending.includes(p.id))
    const guestPlayers = []
    base.forEach(p => {
      const count = guests[p.id] || 0
      for (let i = 1; i <= count; i++) {
        guestPlayers.push({ id: `guest_${p.id}_${i}`, name: `Guest${count > 1 ? ' ' + i : ''} (${p.name.split(' ')[0]})`, skill: 5, positions: ['MID'], isGuest: true, vouchedBy: p.name })
      }
    })
    return [...base, ...guestPlayers]
  }

  const present = buildPresent()
  const totalCount = present.length
  const filtered = useMemo(() => players.filter(p => p.name.toLowerCase().includes(q.toLowerCase())), [players, q])
  const inTeam = useMemo(() => teams ? new Set(teams.flat().map(p => p.id)) : new Set(), [teams])
  const bench = presentPlayers.filter(p => !inTeam.has(p.id))
  const avg = t => t.length ? (t.reduce((s, p) => s + p.skill, 0) / t.length).toFixed(1) : '0'

  const gen = () => {
    const p = buildPresent()
    setPresentPlayers(p)
    setTeams(genTeams(p, n))
    setScores({}); setSaved(false); setSubs([]); setStep('teams')
  }
  const reshuffle = () => { setTeams(genTeams(presentPlayers, n)); setSaved(false); setSubs([]) }

  const doSub = (out, fromTi, inp, inTi) => {
    setTeams(ts => {
      const next = ts.map(t => [...t])
      if (inTi === null) { const i = next[fromTi].findIndex(p => p.id === out.id); next[fromTi][i] = inp }
      else { const i = next[fromTi].findIndex(p => p.id === out.id); const j = next[inTi].findIndex(p => p.id === inp.id); next[fromTi][i] = inp; next[inTi][j] = out }
      return next
    })
    setSubs(s => [...s, { out: out.name, in: inp.name, team: LABELS[fromTi] }])
    setSubModal(null); setSaved(false)
  }

  const fmtDate = () => {
    const d = new Date(gameDate + 'T12:00:00')
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return `${days[d.getDay()]} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${gameTime}`
  }

  const save = async () => {
    setBusy(true)
    const teamData = teams.map(t => t.map(p => ({ name: p.name, positions: p.positions || ['MID'], isGuest: p.isGuest || false })))
    await onSaveGame({
      game_date: fmtDate(),
      team_count: n,
      player_count: totalCount,
      teams: teamData,
      scores: Object.keys(scores).reduce((a, k) => ({ ...a, [k]: +scores[k] || 0 }), {}),
      subs,
    })
    setSaved(true); setBusy(false)

    // Send email + Telegram notifications
    if (groupId) {
      const payload = {
        gameDate: fmtDate(),
        groupName: groupSlug,
        groupId,
        groupUrl: `${window.location.origin}/${groupSlug}`,
        teams: teamData.map(t => t.map(p => p.name)),
      }
      sendEmail('teams_published', payload)
      sendTelegram('teams_published', { ...payload, groupSlug })
    }
  }

  // ── RSVP: create game ──────────────────────────────────────────────────────
  const createRsvpGame = async () => {
    if (!groupId) return
    setCreatingRsvp(true)
    const d = new Date(rsvpDate + 'T12:00:00')
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const gameLabel = `${days[d.getDay()]} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${rsvpTime}`

    const { data: newGame, error } = await sb.from('games').insert({
      group_id: groupId,
      game_date: gameLabel,
      scheduled_at: `${rsvpDate}T${rsvpTime}:00`,
      game_location: rsvpLocation || null,
      rsvp_open: true,
      auto_generate: autoGenerate,
      team_count: n,
      player_count: 0,
      teams: [],
    }).select().single()

    setCreatingRsvp(false)
    if (error || !newGame) return
    setRsvpGameId(newGame.id)
    setRsvpGame(newGame)
    setStep('rsvp-link')

    const link = `${window.location.origin}/${groupSlug}/rsvp/${newGame.id}`

    // Send invite emails to all group players
    if (sendInviteEmails) {
      sendEmail('rsvp_invite', {
        gameDate: gameLabel,
        gameLocation: rsvpLocation || null,
        groupName: groupSlug,
        groupId,
        rsvpUrl: link,
      })
    }

    // Send Telegram message
    sendTelegram('rsvp_invite', {
      groupSlug,
      gameDate: gameLabel,
      gameLocation: rsvpLocation || null,
      groupName: groupSlug,
      rsvpUrl: link,
      currentCount: 0,
    })
  }

  // ── RSVP: load live data ───────────────────────────────────────────────────
  async function loadRsvpLive(gameId) {
    const [{ data: g }, { data: rv }] = await Promise.all([
      sb.from('games').select('*').eq('id', gameId).maybeSingle(),
      sb.from('rsvps')
        .select('id,player_id,auth_user_id,status,guests,players(id,name,first_name,last_name)')
        .eq('game_id', gameId),
    ])
    setRsvpGame(g)
    setRsvpData(rv || [])
    setRsvpGameId(gameId)
    setStep('rsvp-live')
  }

  // ── RSVP: generate teams from RSVPs ───────────────────────────────────────
  const genFromRsvp = async () => {
    const inRsvps = rsvpData.filter(r => r.status === 'in')
    const rsvpPlayers = []

    inRsvps.forEach(r => {
      const pid = r.player_id
      const found = pid ? players.find(p => p.id === pid) : null
      if (found) {
        rsvpPlayers.push(found)
      } else {
        // Player not in roster (unlinked user) — add with default skill
        const pName = r.players?.first_name
          ? `${r.players.first_name} ${r.players.last_name || ''}`.trim()
          : r.players?.name || 'Unknown'
        rsvpPlayers.push({ id: r.id, name: pName, skill: 5, positions: ['MID'] })
      }
      // Add guests
      const gc = r.guests || 0
      for (let i = 1; i <= gc; i++) {
        const host = found || { name: 'Player' }
        rsvpPlayers.push({ id: `guest_rsvp_${r.id}_${i}`, name: `Guest${gc > 1 ? ' ' + i : ''} (${host.name.split(' ')[0]})`, skill: 5, positions: ['MID'], isGuest: true })
      }
    })

    if (rsvpPlayers.length < 2) return

    // Override date to the RSVP game's date
    const g = rsvpGame
    if (g) {
      const d = new Date(g.scheduled_at || g.game_date)
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      setGameDate(g.scheduled_at ? g.scheduled_at.slice(0, 10) : gameDate)
      setGameTime(g.scheduled_at ? g.scheduled_at.slice(11, 16) : gameTime)
    }

    setPresentPlayers(rsvpPlayers)
    setTeams(genTeams(rsvpPlayers, n))
    setScores({}); setSaved(false); setSubs([])
    setStep('teams')
  }

  const rsvpLink = rsvpGameId && groupSlug ? `${window.location.origin}/${groupSlug}/rsvp/${rsvpGameId}` : ''

  const copyLink = () => {
    navigator.clipboard.writeText(rsvpLink).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) })
  }

  const closeRsvp = async () => {
    if (!rsvpGameId) return
    await sb.from('games').update({ rsvp_open: false }).eq('id', rsvpGameId)
    setRsvpGame(g => ({ ...g, rsvp_open: false }))
  }

  // ─── Non-admin view ───────────────────────────────────────────────────────
  if (!isAdmin) return <ViewerGame games={games} />

  // ─── Mode picker ──────────────────────────────────────────────────────────
  if (step === 'mode') return (
    <div className="section">
      <div className="hrow"><span className="page-title">Teams</span></div>

      {/* Active RSVP games */}
      {openRsvpGames.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Active RSVP games</div>
          {openRsvpGames.map(g => (
            <div key={g.id} className="card-wrap" style={{ padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
              onClick={() => loadRsvpLive(g.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>📅 {g.game_date}</div>
                {g.game_location && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>📍 {g.game_location}</div>}
              </div>
              <div style={{ background: '#eaf5e0', color: '#2d5509', border: '1px solid #a8d87a', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700 }}>RSVP open</div>
              <span style={{ color: '#2d5509', fontWeight: 700 }}>→</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Create new game</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="card-wrap" style={{ padding: '16px 14px', cursor: 'pointer' }} onClick={() => setStep('rsvp-form')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28 }}>📨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>RSVP game</div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>Share a link → players vote In/Out → generate teams from respondents</div>
            </div>
            <span style={{ color: '#2d5509', fontWeight: 700, fontSize: 18 }}>→</span>
          </div>
        </div>
        <div className="card-wrap" style={{ padding: '16px 14px', cursor: 'pointer' }} onClick={() => setStep('attend')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 28 }}>✋</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>Manual selection</div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4 }}>Pick who's playing → generate teams → publish</div>
            </div>
            <span style={{ color: '#2d5509', fontWeight: 700, fontSize: 18 }}>→</span>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── RSVP form ────────────────────────────────────────────────────────────
  if (step === 'rsvp-form') return (
    <div className="section">
      <div className="hrow">
        <button className="btn sm" onClick={() => setStep('mode')}>← Back</button>
        <span className="page-title">New RSVP game</span>
      </div>
      <div className="card-wrap" style={{ padding: '14px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 500 }}>📅 Game date &amp; time</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={rsvpDate} onChange={e => setRsvpDate(e.target.value)} style={{ flex: 2 }} />
          <input type="time" value={rsvpTime} onChange={e => setRsvpTime(e.target.value)} style={{ flex: 1 }} />
        </div>
      </div>
      <div className="card-wrap" style={{ padding: '14px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 500 }}>📍 Location (optional)</div>
        <input value={rsvpLocation} onChange={e => setRsvpLocation(e.target.value)} placeholder="e.g. Westwood Park Field 2" />
      </div>
      <div className="card-wrap" style={{ padding: '14px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 500 }}>Teams</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, margin: 0 }}>Number of teams:</label>
          <select value={n} onChange={e => setN(+e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 13 }}>
            <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
          </select>
        </div>
      </div>
      <div className="card-wrap" style={{ padding: '14px', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={autoGenerate} onChange={e => setAutoGenerate(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2d5509' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Auto-generate teams 1.5h before game</div>
            <div style={{ fontSize: 12, color: '#888' }}>Teams are generated automatically from RSVP responses</div>
          </div>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={sendInviteEmails} onChange={e => setSendInviteEmails(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#2d5509' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Send email invites to all players</div>
            <div style={{ fontSize: 12, color: '#888' }}>Players with linked accounts will receive an email</div>
          </div>
        </label>
      </div>
      <button className="btn primary full" onClick={createRsvpGame} disabled={creatingRsvp || !rsvpDate}>
        {creatingRsvp ? 'Creating…' : 'Create RSVP game →'}
      </button>
    </div>
  )

  // ─── RSVP link screen ─────────────────────────────────────────────────────
  if (step === 'rsvp-link') return (
    <div className="section">
      <div className="hrow">
        <span className="page-title">RSVP game created!</span>
      </div>
      <div style={{ background: '#eaf5e0', border: '1px solid #a8d87a', borderRadius: 10, padding: '14px 16px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#2a5c0e', marginBottom: 4 }}>Game created successfully</div>
        <div style={{ fontSize: 13, color: '#555' }}>{rsvpGame?.game_date}</div>
        {rsvpGame?.game_location && <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>📍 {rsvpGame.game_location}</div>}
      </div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 8, fontWeight: 500 }}>Share this link with players:</div>
      <div style={{ background: '#f5f5f0', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 13, wordBreak: 'break-all', color: '#333', marginBottom: 10 }}>
        {rsvpLink}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn primary" style={{ flex: 1 }} onClick={copyLink}>
          {linkCopied ? '✓ Copied!' : '📋 Copy link'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent('Are you in for soccer? RSVP here: ' + rsvpLink)}`}
          target="_blank" rel="noopener"
          style={{ flex: 1, background: '#25D366', color: '#fff', borderRadius: 8, border: 'none', padding: '10px', fontWeight: 600, fontSize: 14, cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          WhatsApp
        </a>
      </div>
      <button className="btn full" onClick={() => loadRsvpLive(rsvpGameId)}>
        View live RSVPs →
      </button>
      <button className="btn full" style={{ marginTop: 8 }} onClick={() => setStep('mode')}>
        ← Back to Teams
      </button>
    </div>
  )

  // ─── RSVP live view ───────────────────────────────────────────────────────
  if (step === 'rsvp-live') {
    const inList = rsvpData.filter(r => r.status === 'in')
    const outList = rsvpData.filter(r => r.status === 'out')
    const totalIn = inList.reduce((s, r) => s + 1 + (r.guests || 0), 0)

    const pName = r => {
      if (r.players?.first_name) return `${r.players.first_name} ${r.players.last_name || ''}`.trim()
      return r.players?.name || 'Unknown'
    }

    return (
      <div className="section">
        <div className="hrow">
          <button className="btn sm" onClick={() => setStep('mode')}>← Back</button>
          <span className="page-title">RSVPs</span>
          <button className="btn sm" onClick={() => loadRsvpLive(rsvpGameId)}>↺ Refresh</button>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: '#2d5509' }}>📅 {rsvpGame?.game_date}</div>
          {rsvpGame?.game_location && <div style={{ color: '#888', marginTop: 2 }}>📍 {rsvpGame.game_location}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {rsvpGame?.rsvp_open !== false
              ? <span style={{ background: '#eaf5e0', color: '#2d5509', border: '1px solid #a8d87a', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>RSVP open</span>
              : <span style={{ background: '#f5f5f5', color: '#888', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>RSVP closed</span>
            }
            {rsvpGame?.rsvp_open !== false && (
              <button className="btn sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={closeRsvp}>Close RSVP</button>
            )}
          </div>
        </div>

        {/* Share link */}
        {rsvpLink && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, background: '#f5f5f0', border: '1px solid #e0e0e0', borderRadius: 8, padding: '7px 10px', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#555' }}>{rsvpLink}</div>
              <button className="btn sm primary" onClick={copyLink}>{linkCopied ? '✓' : '📋'}</button>
            </div>
          </div>
        )}

        {/* In list */}
        <div className="card-wrap" style={{ padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            In ({totalIn})
          </div>
          {inList.length === 0
            ? <p style={{ fontSize: 13, color: '#888' }}>No responses yet</p>
            : inList.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < inList.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eaf5e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#2d5509', flexShrink: 0 }}>✓</div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{pName(r)}</span>
                {r.guests > 0 && <span style={{ fontSize: 12, color: '#888' }}>+{r.guests} guest{r.guests > 1 ? 's' : ''}</span>}
              </div>
            ))
          }
        </div>

        {/* Out list */}
        {outList.length > 0 && (
          <div className="card-wrap" style={{ padding: '12px 14px', marginBottom: 10, opacity: 0.7 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Out ({outList.length})</div>
            {outList.map(r => (
              <div key={r.id} style={{ fontSize: 13, color: '#888', padding: '4px 0' }}>✗ {pName(r)}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, margin: 0 }}>Teams:</label>
            <select value={n} onChange={e => setN(+e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 13 }}>
              <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
            </select>
          </div>
          <button className="btn primary full" onClick={genFromRsvp} disabled={totalIn < 2}>
            Generate teams from {totalIn} player{totalIn !== 1 ? 's' : ''}
          </button>
          <button className="btn full" style={{ fontSize: 13 }} onClick={() => setStep('attend')}>
            Switch to manual selection
          </button>
        </div>
      </div>
    )
  }

  // ─── Manual: Attend step ──────────────────────────────────────────────────
  if (step === 'attend') return (
    <div className="section">
      <div className="hrow">
        <button className="btn sm" onClick={() => setStep('mode')}>← Back</button>
        <span className="page-title">Who's playing?</span>
        {totalCount > 0 && <span className="count">{totalCount} in</span>}
      </div>
      <div className="card-wrap" style={{ padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 500 }}>📅 Game date &amp; time</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} style={{ flex: 2 }} />
          <input type="time" value={gameTime} onChange={e => setGameTime(e.target.value)} style={{ flex: 1 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <button className="btn sm" onClick={() => setAttending(players.map(p => p.id))}>All</button>
        <button className="btn sm" onClick={() => { setAttending([]); setGuests({}) }}>Clear</button>
        <div style={{ flex: 1 }} />
        <label style={{ margin: 0, fontSize: 12 }}>Teams:</label>
        <select value={n} onChange={e => setN(+e.target.value)} style={{ width: 'auto', padding: '5px 8px', fontSize: 13 }}>
          <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍  Search…" /></div>
      <div className="card-wrap" style={{ marginBottom: 14 }}>
        {filtered.map(p => {
          const isIn = attending.includes(p.id)
          const gCount = guests[p.id] || 0
          return (
            <div key={p.id}>
              <div className="crow" onClick={() => { tog(p.id); if (isIn) setGuests(g => { const n = { ...g }; delete n[p.id]; return n }) }}>
                <div className={`chk${isIn ? ' on' : ''}`}>{isIn && <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                <Av name={p.name} size={28} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: 14 }}>{p.name}</span>
                <span className="spill">★{p.skill}</span>
              </div>
              {isIn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 8px 38px', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: 11, color: '#888' }}>+ guests:</span>
                  <button className="btn sm" style={{ padding: '2px 8px', fontSize: 12, minWidth: 24 }} onClick={e => { e.stopPropagation(); if (gCount > 0) removeGuest(p.id) }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center', color: gCount > 0 ? '#2d5509' : '#ccc' }}>{gCount}</span>
                  <button className="btn sm" style={{ padding: '2px 8px', fontSize: 12, minWidth: 24 }} onClick={e => { e.stopPropagation(); addGuest(p.id) }}>+</button>
                  {gCount > 0 && <span style={{ fontSize: 11, color: '#2d5509', fontWeight: 600 }}>
                    {gCount === 1 ? `Guest (${p.name.split(' ')[0]})` : `${gCount} guests (${p.name.split(' ')[0]})`}
                    <span style={{ color: '#888', fontWeight: 400 }}> · skill 5 each</span>
                  </span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {totalCount < 2 && <div className="alert amber">Select at least 2 players</div>}
      <button className="btn primary full" onClick={gen} disabled={totalCount < 2}>
        Generate teams ({totalCount} players{Object.values(guests).reduce((a, b) => a + b, 0) > 0 ? `, incl. ${Object.values(guests).reduce((a, b) => a + b, 0)} guest${Object.values(guests).reduce((a, b) => a + b, 0) > 1 ? 's' : ''}` : ''})
      </button>
    </div>
  )

  // ─── Teams display ────────────────────────────────────────────────────────
  return (
    <div className="section">
      <div className="hrow">
        <button className="btn sm" onClick={() => { setStep('mode'); setTeams(null); setSaved(false) }}>← Back</button>
        <span className="page-title">Teams</span>
        <span className="count">{presentPlayers.length} playing</span>
      </div>
      <div style={{ background: '#eaf5e0', border: '1px solid #a8d87a', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#2d5509' }}>
        📅 {fmtDate()}
      </div>
      {subs.length > 0 && <div className="alert amber"><b>Subs:</b> {subs.map((s, i) => <span key={i}>{i > 0 ? ', ' : ''}{s.out}→{s.in} (T{s.team})</span>)}</div>}
      {teams && teams.map((team, ti) => (
        <div key={ti} className={`tbox t${ti}`}>
          <div className="ttitle">
            <span>TEAM {LABELS[ti]}</span>
            {isAdmin && <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.65 }}>avg ★{avg(team)}</span>}
          </div>
          {team.map(p => (
            <div key={p.id} className="tplayer">
              <Av name={p.name} size={26} />
              <span style={{ flex: 1, fontWeight: 500 }}>
                {p.name}{p.donor && <span style={{ fontSize: 12, marginLeft: 4 }}>💚</span>}
                {p.isGuest && <span style={{ fontSize: 10, background: '#fef6e4', color: '#7a4d00', border: '1px solid #f0c060', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700 }}>GUEST</span>}
              </span>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(p.positions || ['MID']).map(pos => <span key={pos} className={`ptag ${pos}`}>{pos}</span>)}
              </div>
              {isAdmin && <span style={{ fontSize: 11, color: '#888', margin: '0 4px', flexShrink: 0 }}>★{p.skill}</span>}
              <button className="btn sm warn" style={{ padding: '3px 8px', fontSize: 11, flexShrink: 0 }} onClick={() => setSubModal({ player: p, teamIdx: ti })}>SUB</button>
            </div>
          ))}
        </div>
      ))}
      {bench.length > 0 && <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Bench: {bench.slice(0, 5).map(p => p.name).join(', ')}{bench.length > 5 ? ` +${bench.length - 5} more` : ''}</div>}
      <div className="card-wrap" style={{ padding: '12px 14px', marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 500 }}>Score after game (optional)</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {teams && teams.map((t, ti) => (
            <div key={ti} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 600 }}>TEAM {LABELS[ti]}</div>
              <input type="number" min="0" value={scores[ti] ?? ''} onChange={e => setScores(s => ({ ...s, [ti]: e.target.value }))} placeholder="0" style={{ width: 54, textAlign: 'center', fontSize: 20, fontWeight: 700 }} />
            </div>
          ))}
        </div>
      </div>
      <button className="reshuffle" onClick={() => { reshuffle(); setSaved(false) }}>↺ Reshuffle teams</button>
      {saved
        ? <div style={{ marginTop: 10 }}>
          <div className="alert green" style={{ textAlign: 'center', marginBottom: 8 }}>Published ✓ — visible to everyone</div>
          <button className="btn full" style={{ fontSize: 13, color: '#2d5509', borderColor: '#a8d87a' }} onClick={() => setSaved(false)}>Make changes</button>
        </div>
        : <button className="btn primary full" style={{ marginTop: 10 }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save & publish teams'}</button>
      }
      {subModal && <SubModal player={subModal.player} teamIdx={subModal.teamIdx} teams={teams} bench={bench} onSub={doSub} onClose={() => setSubModal(null)} isAdmin={isAdmin} />}
    </div>
  )
}
