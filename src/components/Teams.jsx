import { useState, useMemo } from 'react'
import Av from './Av'
import { LABELS } from '../lib/constants'
import { genTeams } from '../lib/utils'

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

export default function Teams({ players, onSaveGame, isAdmin, games }) {
  const [step, setStep] = useState('attend')
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
  const [gameDate, setGameDate] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const daysUntilSunday = day === 0 ? 7 : (7 - day)
    d.setDate(d.getDate() + daysUntilSunday)
    return d.toISOString().slice(0, 10)
  })
  const [gameTime, setGameTime] = useState('08:00')

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

  const [presentPlayers, setPresentPlayers] = useState([])
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
    await onSaveGame({
      game_date: fmtDate(),
      team_count: n,
      player_count: totalCount,
      teams: teams.map(t => t.map(p => ({ name: p.name, positions: p.positions || ['MID'], isGuest: p.isGuest || false }))),
      scores: Object.keys(scores).reduce((a, k) => ({ ...a, [k]: +scores[k] || 0 }), {}),
      subs,
    })
    setSaved(true); setBusy(false)
  }

  if (!isAdmin) return <ViewerGame games={games} />

  if (step === 'attend') return (
    <div className="section">
      <div className="hrow">
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

  return (
    <div className="section">
      <div className="hrow">
        <button className="btn sm" onClick={() => setStep('attend')}>← Back</button>
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
