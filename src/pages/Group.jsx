import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { LOGO_URL, GROUP_INFO } from '../lib/constants'
import Roster from '../components/Roster'
import Teams from '../components/Teams'
import History from '../components/History'
import Settings from '../components/Settings'
import LoginModal from '../components/LoginModal'
import ApprovalQueue from '../components/ApprovalQueue'

export default function Group() {
  const { groupSlug } = useParams()
  const navigate = useNavigate()
  const groupInfo = GROUP_INFO[groupSlug]

  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('roster')
  const [showLogin, setShowLogin] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [showApprovals, setShowApprovals] = useState(false)
  const [userDisplayName, setUserDisplayName] = useState('')
  const [groupId, setGroupId] = useState(null)
  const [captainGroupId, setCaptainGroupId] = useState(null)

  // Redirect to landing if unknown group
  useEffect(() => {
    if (!groupInfo) navigate('/')
  }, [groupSlug])

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      if (data.session?.user) fetchRole(data.session.user.email)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchRole(session.user.email)
      else { setRole(null); setPendingCount(0) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchRole(email) {
    const { data, error } = await sb.from('user_roles').select('role,player_id,group_id').eq('email', email).maybeSingle()
    if (error) console.error('fetchRole error:', error.message)
    if (data?.role) {
      setRole(data.role)
      if (data.group_id) setCaptainGroupId(data.group_id)
      if (data.role === 'admin' || data.role === 'captain') fetchPendingCount()
      else checkPlayerProfile()
      if (data.player_id) {
        const { data: p } = await sb.from('players').select('first_name,last_name,name').eq('id', data.player_id).maybeSingle()
        if (p) setUserDisplayName(p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.name || '')
      }
      return
    }
    const { data: { user: u } } = await sb.auth.getUser()
    if (u) {
      const { data: linked } = await sb.from('players').select('id,first_name,last_name,name').eq('auth_user_id', u.id).maybeSingle()
      if (linked) {
        if (linked.first_name) setUserDisplayName(`${linked.first_name} ${linked.last_name || ''}`.trim())
        else setUserDisplayName(linked.name || '')
        const { data: byPlayer } = await sb.from('user_roles').select('role,group_id').eq('player_id', linked.id).maybeSingle()
        if (byPlayer?.role) {
          setRole(byPlayer.role)
          if (byPlayer.group_id) setCaptainGroupId(byPlayer.group_id)
          fetchPendingCount()
          return
        }
      }
    }
    setUserDisplayName(email.split('@')[0])
    setRole(null)
    checkPlayerProfile()
  }

  async function checkPlayerProfile() {
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) return
    const { data: linked } = await sb.from('players').select('id').eq('auth_user_id', u.id).maybeSingle()
    if (linked) return
    const { data: pending } = await sb.from('pending_profiles').select('id').eq('auth_user_id', u.id).maybeSingle()
    if (!pending) window.location.href = '/profile'
  }

  async function fetchPendingCount() {
    const { count } = await sb.from('pending_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    setPendingCount(count || 0)
  }

  useEffect(() => { if (groupSlug && groupInfo) load() }, [groupSlug])

  async function load() {
    setLoading(true)
    const { data: grp } = await sb.from('groups').select('id,name').eq('slug', groupSlug).single()
    if (!grp) { setLoading(false); return }
    setGroupId(grp.id)

    const { data: pgData } = await sb.from('player_groups')
      .select('skill, players(id,name,positions,photo_url,auth_user_id,donor,profile_complete,date_of_birth,is_minor)')
      .eq('group_id', grp.id)
      .eq('active', true)
    const ps = (pgData || [])
      .map(pg => ({ ...pg.players, skill: pg.skill }))
      .filter(p => p && p.id)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    setPlayers(ps)

    const { data: g } = await sb.from('games').select('*').eq('group_id', grp.id).order('created_at', { ascending: false })
    setGames(g || [])
    setLoading(false)
  }

  const addPlayer = async f => {
    if (!groupId) return
    const { data: newP } = await sb.from('players').insert({ name: f.name, positions: f.positions, games_played: 0 }).select().single()
    if (newP) await sb.from('player_groups').insert({ player_id: newP.id, group_id: groupId, skill: f.skill, added_by: 'captain' })
    await load()
  }
  const updatePlayer = async (id, f) => {
    if (!groupId) return
    await sb.from('players').update({ name: f.name, positions: f.positions }).eq('id', id)
    await sb.from('player_groups').update({ skill: f.skill }).eq('player_id', id).eq('group_id', groupId)
    await load()
  }
  const deletePlayer = async id => {
    if (!groupId) return
    await sb.from('player_groups').update({ active: false }).eq('player_id', id).eq('group_id', groupId)
    await load()
  }
  const saveGame = async data => {
    if (!groupId) return
    await sb.from('games').insert({ ...data, group_id: groupId })
    await load()
  }
  const updateGame = async (id, data) => { await sb.from('games').update(data).eq('id', id); await load() }
  const deleteGame = async id => { await sb.from('games').delete().eq('id', id); await load() }

  const isAdmin = role === 'admin'
  const isCaptain = role === 'admin' || (role === 'captain' && (!captainGroupId || captainGroupId === groupId))
  const roleBadge = role === 'admin' ? 'ADMIN' : role === 'captain' ? 'CAPTAIN' : role ? 'PLAYER' : null

  async function handleLogout() {
    await sb.auth.signOut()
    navigate('/')
  }

  if (!groupInfo) return null

  if (loading) return (
    <div className="loading">
      <img src={LOGO_URL} style={{ width: 56, height: 56, borderRadius: 12 }} alt="logo" />
      Loading…
    </div>
  )

  if (showSettings && isAdmin) return (
    <div className="app">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <img src={LOGO_URL} alt="logo" className="hdr-logo" />
          <div><h1 style={{ fontSize: 16 }}>{groupInfo.name}</h1></div>
        </div>
        <span className="admin-badge">ADMIN</span>
      </div>
      <Settings role={role} players={players} groupSlug={groupSlug} groupId={groupId} onClose={() => { setShowSettings(false); load() }} />
    </div>
  )

  return (
    <div className="app">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ lineHeight: 0, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <img src={LOGO_URL} alt="logo" className="hdr-logo" />
          </div>
          <div>
            <h1 style={{ fontSize: 16 }}>{groupInfo.name}</h1>
            <p>{groupInfo.schedule}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {user && userDisplayName && (
            <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userDisplayName}</div>
              {roleBadge && <div style={{ fontSize: 10, color: role === 'admin' ? '#a8d87a' : role === 'captain' ? '#ffd700' : 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: 0.4 }}>{roleBadge}</div>}
            </div>
          )}
          {isCaptain && pendingCount > 0 && (
            <button className="hdr-btn" style={{ background: '#e07b5a', border: 'none' }} onClick={() => setShowApprovals(true)}>
              👤 <span style={{ background: '#fff', color: '#c0392b', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{pendingCount}</span>
            </button>
          )}
          {isAdmin && <button className="hdr-btn" onClick={() => setShowSettings(true)}>⚙️</button>}
          {user && <a href="/profile" className="hdr-btn" style={{ fontSize: 11, textDecoration: 'none', padding: '5px 8px' }}>👤</a>}
          {user
            ? <button className="hdr-btn" onClick={handleLogout}>Logout</button>
            : <button className="hdr-btn" onClick={() => setShowLogin(true)}>Login</button>
          }
        </div>
      </div>
      <nav>
        {[['roster', '👥 Roster'], ['game', '⚽ Teams'], ['history', '📋 History']].map(([v, l]) => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{l}</button>
        ))}
      </nav>
      {view === 'roster' && <Roster players={players} isAdmin={isCaptain} canDelete={isAdmin} groupSlug={groupSlug} onAdd={addPlayer} onUpdate={updatePlayer} onDelete={deletePlayer} />}
      {view === 'game' && <Teams players={players} isAdmin={isCaptain} onSaveGame={saveGame} games={games} groupId={groupId} groupSlug={groupSlug} />}
      {view === 'history' && <History games={games} players={players} isAdmin={isCaptain} canDelete={isAdmin} onUpdateGame={updateGame} onDeleteGame={deleteGame} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showApprovals && <ApprovalQueue onClose={() => { setShowApprovals(false); fetchPendingCount() }} players={players} onApproved={() => { load(); fetchPendingCount() }} />}
      <div style={{ textAlign: 'center', padding: '24px 16px 8px', borderTop: '1px solid #e0e0e0', marginTop: 8 }}>
        <a href="/privacy" target="_blank" style={{ fontSize: 12, color: '#888', textDecoration: 'none', marginRight: 16 }}>Privacy Policy</a>
        <a href="/deletion" target="_blank" style={{ fontSize: 12, color: '#888', textDecoration: 'none', marginRight: 16 }}>Data Deletion</a>
        <span style={{ fontSize: 12, color: '#ccc' }}>soccer.dvornikov.pro</span>
      </div>
    </div>
  )
}
