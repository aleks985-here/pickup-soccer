import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { LOGO_URL, GROUP_INFO } from '../lib/constants'
import LoginModal from '../components/LoginModal'

export default function Landing() {
  const [user, setUser] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
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
