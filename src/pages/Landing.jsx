import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { LOGO_URL, GROUP_INFO } from '../lib/constants'
import LoginModal from '../components/LoginModal'

export default function Landing() {
  const [user, setUser] = useState(null)
  const [userDisplayName, setUserDisplayName] = useState('')
  const [showLogin, setShowLogin] = useState(false)
  const navigate = useNavigate()

  async function fetchUserInfo(authUser) {
    const { data: p } = await sb.from('players')
      .select('first_name,last_name,name,primary_group_id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()
    if (p) {
      setUserDisplayName(p.first_name ? `${p.first_name} ${p.last_name || ''}`.trim() : p.name || '')
      return p.primary_group_id
    }
    setUserDisplayName(authUser.email?.split('@')[0] || '')
    return null
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) fetchUserInfo(u)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, s) => {
      const u = s?.user ?? null
      setUser(u)
      if (u) {
        const primaryGroupId = await fetchUserInfo(u)
        if (event === 'SIGNED_IN' && primaryGroupId) {
          const { data: grp } = await sb.from('groups').select('slug').eq('id', primaryGroupId).maybeSingle()
          if (grp?.slug && GROUP_INFO[grp.slug]) { navigate(`/${grp.slug}`); return }
        }
      } else {
        setUserDisplayName('')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="landing">
      <div className="landing-header">
        <div className="landing-header-left">
          <img src={LOGO_URL} alt="Pickup Soccer logo" />
          <span>Pickup Soccer</span>
        </div>
        <div className="landing-header-right">
          {user && userDisplayName && (
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginRight: 6 }}>{userDisplayName}</span>
          )}
          {user
            ? <button className="hdr-btn" onClick={() => sb.auth.signOut()}>Logout</button>
            : <button className="hdr-btn" onClick={() => setShowLogin(true)}>Login</button>
          }
        </div>
      </div>

      <div className="landing-hero">
        <h2>Fair teams.<br />Every game.</h2>
        <p>The app that balances your pickup soccer game by skill and position — automatically.</p>
      </div>

      <div className="landing-groups">
        <h3>Choose your group</h3>
        {Object.entries(GROUP_INFO).map(([slug, g]) => (
          <div key={slug} className="group-card" onClick={() => navigate(`/${slug}`)}>
            <div className="group-card-left">
              <h4>{g.name}</h4>
              <p>{g.schedule} · {g.location}</p>
            </div>
            <div className="group-card-right">{g.emoji} →</div>
          </div>
        ))}
      </div>

      <div className="landing-how">
        <h3>How it works</h3>
        <div className="how-steps">
          <div className="how-step">
            <div className="how-step-num">1</div>
            <div className="how-step-text">
              <strong>RSVP via WhatsApp or Telegram</strong>
              <span>Captain shares the link. Players tap "I'm in" from their phone.</span>
            </div>
          </div>
          <div className="how-step">
            <div className="how-step-num">2</div>
            <div className="how-step-text">
              <strong>Teams balanced automatically</strong>
              <span>App splits players by skill rating and preferred position for even teams.</span>
            </div>
          </div>
          <div className="how-step">
            <div className="how-step-num">3</div>
            <div className="how-step-text">
              <strong>See your team — just show up</strong>
              <span>Teams are published here. Open the link, find your team, play.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-footer">
        <a href="/privacy">Privacy Policy</a>
        <a href="/deletion">Data Deletion</a>
        <a href="/profile">My Profile</a>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
