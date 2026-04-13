import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { LOGO_URL } from '../lib/constants'
import LoginModal from '../components/LoginModal'

export default function Rsvp() {
  const { groupSlug, gameId } = useParams()
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [myPlayer, setMyPlayer] = useState(null)
  const [game, setGame] = useState(null)
  const [rsvps, setRsvps] = useState([])
  const [myRsvp, setMyRsvp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [guestCount, setGuestCount] = useState(0)
  const [showLogin, setShowLogin] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
    loadGame()
    return () => subscription.unsubscribe()
  }, [gameId])

  useEffect(() => {
    if (!user) return
    sb.from('players').select('id,name,first_name,last_name').eq('auth_user_id', user.id).maybeSingle()
      .then(({ data }) => setMyPlayer(data))
    // Reload RSVPs to find user's existing RSVP
    loadGame()
  }, [user])

  async function loadGame() {
    const [{ data: g }, { data: rv }] = await Promise.all([
      sb.from('games').select('*').eq('id', gameId).maybeSingle(),
      sb.from('rsvps')
        .select('id,player_id,auth_user_id,status,guests,players(name,first_name,last_name)')
        .eq('game_id', gameId)
        .order('created_at'),
    ])
    setGame(g)
    setRsvps(rv || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!user || !rsvps.length) return
    const mine = rsvps.find(r => r.auth_user_id === user.id)
    if (mine) {
      setMyRsvp(mine)
      setGuestCount(mine.guests || 0)
      setDone(true)
    }
  }, [user, rsvps])

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

  function playerName(r) {
    if (r.players?.first_name) return `${r.players.first_name} ${r.players.last_name || ''}`.trim()
    if (r.players?.name) return r.players.name
    return 'Player'
  }

  const inList = rsvps.filter(r => r.status === 'in')
  const outList = rsvps.filter(r => r.status === 'out')
  const totalIn = inList.reduce((s, r) => s + 1 + (r.guests || 0), 0)
  const myStatus = myRsvp?.status

  function fmtGameDate(g) {
    if (g.scheduled_at) {
      const d = new Date(g.scheduled_at)
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return g.game_date || 'TBD'
  }

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
    <div style={{ maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', background: '#f5f5f0', color: '#1a1a1a' }}>
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

      <div style={{ padding: '20px 16px' }}>
        {/* Game card */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 16, border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Game details</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>⚽ {fmtGameDate(game)}</div>
          {game.game_location && <div style={{ fontSize: 14, color: '#555', marginBottom: 4 }}>📍 {game.game_location}</div>}
          <div style={{ fontSize: 13, color: '#888' }}>{totalIn} player{totalIn !== 1 ? 's' : ''} in so far</div>
          {!game.rsvp_open && <div style={{ marginTop: 8, background: '#fff5e0', border: '1px solid #f0c060', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#7a4d00' }}>RSVP is closed</div>}
        </div>

        {/* RSVP action */}
        {game.rsvp_open && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 16, border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              {done ? 'Your RSVP' : 'Are you in?'}
            </div>

            {!user ? (
              <div>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>Sign in to RSVP for this game.</p>
                <button onClick={() => setShowLogin(true)} style={{ width: '100%', background: '#2d5509', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  Sign in to RSVP
                </button>
              </div>
            ) : (
              <div>
                {done && myStatus && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 14, fontWeight: 600,
                    background: myStatus === 'in' ? '#eaf5e0' : '#fff5f5',
                    color: myStatus === 'in' ? '#2a5c0e' : '#c0392b',
                    border: `1px solid ${myStatus === 'in' ? '#a8d87a' : '#f5c6c6'}`,
                  }}>
                    {myStatus === 'in' ? `\u2713 You\u2019re in! ${guestCount > 0 ? `+${guestCount} guest${guestCount > 1 ? 's' : ''}` : ''}` : '\u2717 You\u2019re sitting this one out'}
                  </div>
                )}

                {myStatus === 'in' && (
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
                  <button
                    onClick={() => submitRsvp('in')}
                    disabled={submitting}
                    style={{ flex: 1, padding: 13, borderRadius: 8, border: `2px solid ${myStatus === 'in' ? '#2d5509' : '#e0e0e0'}`, background: myStatus === 'in' ? '#2d5509' : '#fff', color: myStatus === 'in' ? '#fff' : '#555', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    ✓ I'm in
                  </button>
                  <button
                    onClick={() => submitRsvp('out')}
                    disabled={submitting}
                    style={{ flex: 1, padding: 13, borderRadius: 8, border: `2px solid ${myStatus === 'out' ? '#c0392b' : '#e0e0e0'}`, background: myStatus === 'out' ? '#fff5f5' : '#fff', color: myStatus === 'out' ? '#c0392b' : '#555', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    ✗ Can't make it
                  </button>
                </div>

                {myStatus === 'in' && guestCount > 0 && done && (
                  <button onClick={() => submitRsvp('in')} disabled={submitting}
                    style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 8, border: '1px solid #a8d87a', background: '#eaf5e0', color: '#2d5509', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Update guest count
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* RSVP list */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#2d5509', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Who's playing ({totalIn})
          </div>

          {inList.length === 0 ? (
            <p style={{ fontSize: 14, color: '#888' }}>Nobody has RSVP'd yet. Be the first!</p>
          ) : (
            <div style={{ marginBottom: outList.length > 0 ? 14 : 0 }}>
              {inList.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < inList.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eaf5e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#2d5509' }}>✓</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{playerName(r)}</span>
                    {r.guests > 0 && <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>+{r.guests} guest{r.guests > 1 ? 's' : ''}</span>}
                    {r.auth_user_id === user?.id && <span style={{ fontSize: 10, background: '#eaf5e0', color: '#2d5509', border: '1px solid #a8d87a', borderRadius: 4, padding: '1px 5px', marginLeft: 6, fontWeight: 700 }}>YOU</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {outList.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 }}>Can't make it ({outList.length})</div>
              {outList.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', opacity: 0.6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>✗</div>
                  <span style={{ fontSize: 13, color: '#888' }}>{playerName(r)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0 8px', fontSize: 12, color: '#bbb' }}>
          <span onClick={() => navigate(`/${groupSlug}`)} style={{ cursor: 'pointer', color: '#2d5509' }}>Go to {groupSlug} page</span>
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
