import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sb, sendEmail, sendTelegram } from '../lib/supabase'
import { LOGO_URL } from '../lib/constants'
import { genTeams } from '../lib/utils'
import LoginModal from '../components/LoginModal'

export default function Rsvp() {
  const { groupSlug, gameId } = useParams()
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null) // 'admin' | 'captain' | null
  const [myPlayer, setMyPlayer] = useState(null)
  const [game, setGame] = useState(null)
  const [rsvps, setRsvps] = useState([])
  const [allPlayers, setAllPlayers] = useState([]) // full roster for captain add
  const [myRsvp, setMyRsvp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [guestCount, setGuestCount] = useState(0)
  const [showLogin, setShowLogin] = useState(false)
  const [done, setDone] = useState(false)

  // Captain controls
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [addingPlayer, setAddingPlayer] = useState(null)
  const [generatingTeams, setGeneratingTeams] = useState(false)
  const [teamsGenerated, setTeamsGenerated] = useState(false)

  // Countdown
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) fetchUserRole(u)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, s) => {
      const u = s?.user ?? null
      setUser(u)
      if (u) {
        fetchUserRole(u)
        // After login, if there's a saved redirect back to this RSVP, clear it
        const redirect = localStorage.getItem('rsvp_redirect')
        if (redirect && redirect === window.location.pathname) {
          localStorage.removeItem('rsvp_redirect')
        }
      } else { setRole(null); setMyPlayer(null) }
    })
    loadGame()
    return () => subscription.unsubscribe()
  }, [gameId])

  // Countdown timer
  useEffect(() => {
    if (!game?.scheduled_at) return
    const tick = () => {
      const now = new Date()
      const gameTime = new Date(game.scheduled_at)
      const diff = gameTime - now
      if (diff <= 0) { setCountdown('Game time!'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`)
    }
    tick()
    const t = setInterval(tick, 60000)
    return () => clearInterval(t)
  }, [game])

  async function fetchUserRole(u) {
    const { data: p } = await sb.from('players').select('id,name,first_name,last_name').eq('auth_user_id', u.id).maybeSingle()
    if (p) setMyPlayer(p)

    // Check role
    const { data: r } = await sb.from('user_roles').select('role').eq('email', u.email).maybeSingle()
    if (r?.role) { setRole(r.role); return }
    if (p) {
      const { data: r2 } = await sb.from('user_roles').select('role').eq('player_id', p.id).maybeSingle()
      if (r2?.role) setRole(r2.role)
    }
  }

  async function loadGame() {
    const [{ data: g }, { data: rv }] = await Promise.all([
      sb.from('games').select('*').eq('id', gameId).maybeSingle(),
      sb.from('rsvps')
        .select('id,player_id,auth_user_id,status,guests,players(id,name,first_name,last_name)')
        .eq('game_id', gameId)
        .order('created_at'),
    ])
    setGame(g)
    setRsvps(rv || [])
    setLoading(false)

    // Load full roster for captain
    if (g?.group_id) {
      const { data: pg } = await sb.from('player_groups')
        .select('players(id,name,first_name,last_name)')
        .eq('group_id', g.group_id)
        .eq('active', true)
      setAllPlayers((pg || []).map(r => r.players).filter(Boolean))
    }
  }

  // Find my RSVP when rsvps or user changes
  useEffect(() => {
    if (!user || !rsvps.length) return
    const mine = rsvps.find(r => r.auth_user_id === user.id)
    if (mine) {
      setMyRsvp(mine)
      setGuestCount(mine.guests || 0)
      setDone(true)
    }
  }, [user, rsvps])

  const isCaptain = role === 'admin' || role === 'captain'

  async function submitRsvp(status) {
    if (!user) { setShowLogin(true); return }
    setSubmitting(true)
    const payload = {
      game_id: gameId,
      auth_user_id: user.id,
      player_id: myPlayer?.id || null,
      status,
      guests: status === 'in' ? guestCount : 0,
    }
    if (myRsvp) {
      await sb.from('rsvps').update(payload).eq('id', myRsvp.id)
    } else {
      await sb.from('rsvps').insert(payload)
    }
    await loadGame()
    setDone(true)
    setSubmitting(false)
  }

  async function captainAddPlayer(player) {
    setAddingPlayer(player.id)
    const existing = rsvps.find(r => r.player_id === player.id)
    if (existing) {
      await sb.from('rsvps').update({ status: 'in' }).eq('id', existing.id)
    } else {
      await sb.from('rsvps').insert({
        game_id: gameId,
        player_id: player.id,
        status: 'in',
        guests: 0,
        added_by: 'captain',
      })
    }
    await loadGame()
    setAddingPlayer(null)
    setShowAddPlayer(false)
    setAddSearch('')
  }

  async function captainRemovePlayer(rsvpId) {
    await sb.from('rsvps').delete().eq('id', rsvpId)
    await loadGame()
  }

  async function toggleRsvpOpen() {
    const newVal = !game.rsvp_open
    await sb.from('games').update({ rsvp_open: newVal }).eq('id', gameId)
    setGame(g => ({ ...g, rsvp_open: newVal }))
  }

  async function generateTeamsNow() {
    setGeneratingTeams(true)
    const inRsvps = rsvps.filter(r => r.status === 'in')
    const present = []
    inRsvps.forEach(r => {
      const p = allPlayers.find(p => p.id === r.player_id)
      const name = p
        ? (p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.name)
        : (r.players?.first_name ? `${r.players.first_name} ${r.players.last_name || ''}`.trim() : r.players?.name || 'Unknown')
      present.push({ id: r.player_id || r.id, name, skill: 5, positions: ['MID'] })
      for (let i = 1; i <= (r.guests || 0); i++) {
        present.push({ id: `guest_${r.id}_${i}`, name: `Guest (${name.split(' ')[0]})`, skill: 5, positions: ['MID'], isGuest: true })
      }
    })
    if (present.length < 2) { setGeneratingTeams(false); return }
    const n = game.team_count || 2
    const teams = genTeams(present, n)
    await sb.from('games').update({
      teams: teams.map(t => t.map(p => ({ name: p.name, positions: p.positions, isGuest: p.isGuest || false }))),
      player_count: present.length,
      rsvp_open: false,
      teams_generated_at: new Date().toISOString(),
    }).eq('id', gameId)
    await loadGame()
    setTeamsGenerated(true)
    setGeneratingTeams(false)

    // Send email + Telegram notifications
    if (game.group_id) {
      const payload = {
        gameDate: game.game_date,
        groupName: groupSlug,
        groupId: game.group_id,
        groupUrl: `${window.location.origin}/${groupSlug}`,
        teams: teams.map(t => t.map(p => p.name)),
      }
      sendEmail('teams_published', payload)
      sendTelegram('teams_published', { ...payload, groupSlug })
    }
  }

  function playerName(r) {
    if (r.players?.first_name) return `${r.players.first_name} ${r.players.last_name || ''}`.trim()
    if (r.players?.name) return r.players.name
    return 'Player'
  }

  function fmtGameDate(g) {
    if (g.scheduled_at) {
      const d = new Date(g.scheduled_at)
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return g.game_date || 'TBD'
  }

  const inList = rsvps.filter(r => r.status === 'in')
  const outList = rsvps.filter(r => r.status === 'out')
  const totalIn = inList.reduce((s, r) => s + 1 + (r.guests || 0), 0)
  const myStatus = myRsvp?.status

  // Players not yet RSVP'd (for captain add)
  const rsvpdPlayerIds = new Set(rsvps.map(r => r.player_id).filter(Boolean))
  const filteredRoster = useMemo(() => {
    const q = addSearch.toLowerCase()
    return allPlayers
      .filter(p => !rsvpdPlayerIds.has(p.id))
      .filter(p => {
        const n = p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.name || ''
        return n.toLowerCase().includes(q)
      })
  }, [allPlayers, rsvps, addSearch])

  const autoCloseIn = game?.scheduled_at
    ? Math.round((new Date(game.scheduled_at) - Date.now() - 1 * 3600000) / 60000)
    : null

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
      <img src={LOGO_URL} style={{ width: 48, height: 48, borderRadius: 10 }} alt="logo" />
      <span style={{ color: '#888', fontSize: 14 }}>Loading…</span>
    </div>
  )

  if (!game) return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 20px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚽</div>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Game not found</h2>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 20 }}>This RSVP link may have expired or the game was deleted.</p>
      <button onClick={() => navigate(`/${groupSlug}`)} style={{ background: '#2d5509', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        Go to group page
      </button>
    </div>
  )

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#f5f5f0', color: '#1a1a1a', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#2d5509', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={LOGO_URL} style={{ width: 32, height: 32, borderRadius: 7 }} alt="logo" />
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Pickup Soccer</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{groupSlug.charAt(0).toUpperCase() + groupSlug.slice(1)}</div>
        </div>
        <div style={{ flex: 1 }} />
        {user
          ? <button onClick={() => sb.auth.signOut()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>Logout</button>
          : <button onClick={() => setShowLogin(true)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>Login</button>
        }
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Game card */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 12, border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Game details</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>⚽ {fmtGameDate(game)}</div>
          {game.game_location && <div style={{ fontSize: 14, color: '#555', marginBottom: 4 }}>📍 {game.game_location}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#888' }}>{totalIn} player{totalIn !== 1 ? 's' : ''} in</span>
            {game.rsvp_open
              ? <span style={{ background: '#eaf5e0', color: '#2d5509', border: '1px solid #a8d87a', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>RSVP open</span>
              : <span style={{ background: '#fff5e0', border: '1px solid #f0c060', borderRadius: 5, padding: '2px 7px', fontSize: 11, color: '#7a4d00', fontWeight: 700 }}>RSVP closed</span>
            }
            {countdown && game.rsvp_open && (
              <span style={{ fontSize: 12, color: '#888' }}>⏱ {countdown} to game</span>
            )}
          </div>
          {game.rsvp_open && autoCloseIn !== null && autoCloseIn > 0 && (
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Auto-closes {autoCloseIn < 60 ? `in ${autoCloseIn}m` : `in ${Math.round(autoCloseIn / 60)}h`}</div>
          )}
        </div>

        {/* Captain controls */}
        {isCaptain && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 12, border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e07b5a', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Captain controls</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setShowAddPlayer(v => !v)}
                style={{ flex: 1, minWidth: 120, padding: '8px 12px', borderRadius: 7, border: '1px solid #ccc', background: showAddPlayer ? '#2d5509' : '#fff', color: showAddPlayer ? '#fff' : '#333', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Add player
              </button>
              <button onClick={toggleRsvpOpen}
                style={{ flex: 1, minWidth: 120, padding: '8px 12px', borderRadius: 7, border: '1px solid #ccc', background: '#fff', color: game.rsvp_open ? '#c0392b' : '#2d5509', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {game.rsvp_open ? '🔒 Close RSVP' : '🔓 Reopen RSVP'}
              </button>
            </div>

            {/* Add player search */}
            {showAddPlayer && (
              <div style={{ marginTop: 10 }}>
                <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
                  placeholder="🔍 Search roster…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #ccc', fontSize: 14, boxSizing: 'border-box', marginBottom: 6 }} />
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 7 }}>
                  {filteredRoster.length === 0
                    ? <div style={{ padding: '10px 12px', fontSize: 13, color: '#888' }}>No players found</div>
                    : filteredRoster.slice(0, 20).map(p => {
                      const name = p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.name
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: '#fff' }}
                          onClick={() => captainAddPlayer(p)}>
                          <span style={{ flex: 1, fontSize: 14 }}>{name}</span>
                          {addingPlayer === p.id
                            ? <span style={{ fontSize: 12, color: '#888' }}>Adding…</span>
                            : <span style={{ fontSize: 13, color: '#2d5509', fontWeight: 700 }}>+ Add</span>}
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            )}

            {/* Generate teams */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
              {teamsGenerated
                ? <div style={{ background: '#eaf5e0', border: '1px solid #a8d87a', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: '#2a5c0e', fontWeight: 600 }}>
                    ✓ Teams generated and published!{' '}
                    <span style={{ fontWeight: 400, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/${groupSlug}`)}>View on group page →</span>
                  </div>
                : <button onClick={generateTeamsNow} disabled={generatingTeams || totalIn < 2}
                    style={{ width: '100%', padding: '10px', borderRadius: 7, border: 'none', background: totalIn >= 2 ? '#2d5509' : '#e0e0e0', color: totalIn >= 2 ? '#fff' : '#aaa', fontSize: 14, fontWeight: 700, cursor: totalIn >= 2 ? 'pointer' : 'not-allowed' }}>
                    {generatingTeams ? 'Generating…' : `⚡ Generate teams now (${totalIn} players)`}
                  </button>
              }
            </div>
          </div>
        )}

        {/* RSVP action */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 12, border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            {done ? 'Your RSVP' : game.rsvp_open ? 'Are you in?' : 'RSVP closed'}
          </div>

          {!game.rsvp_open ? (
            <p style={{ fontSize: 14, color: '#888', margin: 0 }}>
              {myStatus === 'in' ? '✓ You RSVPd in for this game.' : myStatus === 'out' ? 'You said you can\'t make it.' : 'RSVP is no longer accepting responses.'}
            </p>
          ) : !user ? (
            <div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>Sign in to RSVP for this game.</p>
              <button onClick={() => {
                localStorage.setItem('rsvp_redirect', window.location.pathname)
                setShowLogin(true)
              }} style={{ width: '100%', background: '#2d5509', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                Sign in to RSVP
              </button>
            </div>
          ) : user && !myPlayer ? (
            <div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
                You need to complete your player profile before RSVPing so the captain knows who you are.
              </p>
              <button onClick={() => {
                localStorage.setItem('rsvp_redirect', window.location.pathname)
                window.location.href = '/profile'
              }} style={{ width: '100%', background: '#2d5509', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                Complete your profile →
              </button>
            </div>
          ) : (
            <div>
              {done && myStatus && (
                <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 14, fontWeight: 600,
                  background: myStatus === 'in' ? '#eaf5e0' : '#fff5f5',
                  color: myStatus === 'in' ? '#2a5c0e' : '#c0392b',
                  border: `1px solid ${myStatus === 'in' ? '#a8d87a' : '#f5c6c6'}` }}>
                  {myStatus === 'in'
                    ? `✓ You're in!${guestCount > 0 ? ` +${guestCount} guest${guestCount > 1 ? 's' : ''}` : ''}`
                    : "✗ You're sitting this one out"}
                </div>
              )}
              {(myStatus === 'in' || !done) && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>Bringing guests?</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setGuestCount(g => Math.max(0, g - 1))} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #ccc', background: '#fff', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>−</button>
                    <span style={{ fontSize: 16, fontWeight: 700, minWidth: 20, textAlign: 'center', color: guestCount > 0 ? '#2d5509' : '#ccc' }}>{guestCount}</span>
                    <button onClick={() => setGuestCount(g => Math.min(3, g + 1))} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #ccc', background: '#fff', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>+</button>
                    <span style={{ fontSize: 12, color: '#888' }}>guests (max 3)</span>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => submitRsvp('in')} disabled={submitting}
                  style={{ flex: 1, padding: 13, borderRadius: 8, border: `2px solid ${myStatus === 'in' ? '#2d5509' : '#e0e0e0'}`, background: myStatus === 'in' ? '#2d5509' : '#fff', color: myStatus === 'in' ? '#fff' : '#555', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ I'm in
                </button>
                <button onClick={() => submitRsvp('out')} disabled={submitting}
                  style={{ flex: 1, padding: 13, borderRadius: 8, border: `2px solid ${myStatus === 'out' ? '#c0392b' : '#e0e0e0'}`, background: myStatus === 'out' ? '#fff5f5' : '#fff', color: myStatus === 'out' ? '#c0392b' : '#555', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  ✗ Can't make it
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RSVP list */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Who's playing ({totalIn})
          </div>
          {inList.length === 0
            ? <p style={{ fontSize: 14, color: '#888', margin: 0 }}>Nobody has RSVP'd yet. Be the first!</p>
            : <div style={{ marginBottom: outList.length > 0 ? 14 : 0 }}>
                {inList.map((r, i) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < inList.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eaf5e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#2d5509', flexShrink: 0 }}>✓</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{playerName(r)}</span>
                      {r.guests > 0 && <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>+{r.guests} guest{r.guests > 1 ? 's' : ''}</span>}
                      {r.added_by === 'captain' && <span style={{ fontSize: 10, background: '#fff5e0', color: '#7a4d00', border: '1px solid #f0c060', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700 }}>CAPTAIN</span>}
                      {r.auth_user_id === user?.id && <span style={{ fontSize: 10, background: '#eaf5e0', color: '#2d5509', border: '1px solid #a8d87a', borderRadius: 4, padding: '1px 5px', marginLeft: 5, fontWeight: 700 }}>YOU</span>}
                    </div>
                    {isCaptain && (
                      <button onClick={() => captainRemovePlayer(r.id)}
                        style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 16, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
                        title="Remove from RSVP">✕</button>
                    )}
                  </div>
                ))}
              </div>
          }
          {outList.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 }}>Can't make it ({outList.length})</div>
              {outList.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', opacity: 0.6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999', flexShrink: 0 }}>✗</div>
                  <span style={{ flex: 1, fontSize: 13, color: '#888' }}>{playerName(r)}</span>
                  {isCaptain && (
                    <button onClick={() => captainRemovePlayer(r.id)}
                      style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 16, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>✕</button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0 8px', fontSize: 12, color: '#bbb' }}>
          <span onClick={() => navigate(`/${groupSlug}`)} style={{ cursor: 'pointer', color: '#2d5509' }}>Go to {groupSlug} page →</span>
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
