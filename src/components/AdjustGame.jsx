import { useState } from 'react'
import Av from './Av'
import { LABELS } from '../lib/constants'

export default function AdjustGame({ game, players, onSave, onClose }) {
  const getName = p => typeof p === 'string' ? p : p.name
  const getPos = p => typeof p === 'string' ? [] : p.positions || []

  const hydrate = t => t.map(p => {
    const name = getName(p)
    const found = players.find(pl => pl.name === name)
    return found ? { ...found } : { id: 'saved_' + name, name, positions: getPos(p), skill: 5, isGuest: (typeof p !== 'string' && p.isGuest) || false }
  })

  const [teams, setTeams] = useState(() => (game.teams || []).map(hydrate))
  const [busy, setBusy] = useState(false)
  const [dragSrc, setDragSrc] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [addQ, setAddQ] = useState('')
  const [addToTeam, setAddToTeam] = useState(0)

  const avg = t => t.length ? (t.reduce((s, p) => s + p.skill, 0) / t.length).toFixed(1) : '0'
  const n = teams.length
  const allInTeams = new Set(teams.flat().map(p => p.id))
  const availablePlayers = players.filter(p => !allInTeams.has(p.id) && p.name.toLowerCase().includes(addQ.toLowerCase()))

  const addFromRoster = (player, teamIdx) => {
    setTeams(ts => { const next = ts.map(t => [...t]); next[teamIdx] = [...next[teamIdx], player]; return next })
    setShowAddPicker(false); setAddQ('')
  }

  const reshuffle = () => {
    const all = teams.flat()
    const sorted = [...all].sort((a, b) => b.skill - a.skill)
    const gks = sorted.filter(p => (p.positions || []).includes('GK'))
    const rest = sorted.filter(p => !gks.slice(0, n).includes(p))
    const next = Array.from({ length: n }, () => [])
    gks.slice(0, n).forEach((g, i) => next[i].push(g))
    rest.forEach((p, i) => { const pass = Math.floor(i / n), pos = i % n; next[pass % 2 === 0 ? pos : (n - 1 - pos)].push(p) })
    const avgS = t => t.length ? t.reduce((s, p) => s + p.skill, 0) / t.length : 0
    for (let iter = 0; iter < 40; iter++) {
      let best = 0, si = -1, sj = -1, sti = -1, stj = -1
      for (let ti = 0; ti < n; ti++) for (let tj = ti + 1; tj < n; tj++)
        for (let i = 0; i < next[ti].length; i++) for (let j = 0; j < next[tj].length; j++) {
          const cur = Math.abs(avgS(next[ti]) - avgS(next[tj]))
          const ni = [...next[ti].slice(0, i), next[tj][j], ...next[ti].slice(i + 1)]
          const nj = [...next[tj].slice(0, j), next[ti][i], ...next[tj].slice(j + 1)]
          const nd = Math.abs(avgS(ni) - avgS(nj))
          if (cur - nd > best) { best = cur - nd; si = i; sj = j; sti = ti; stj = tj }
        }
      if (si < 0) break
      const tmp = next[sti][si]; next[sti][si] = next[stj][sj]; next[stj][sj] = tmp
    }
    setTeams(next)
  }

  const moveToTeam = (player, fromTeam, toTeam) => {
    setTeams(ts => {
      const next = ts.map(t => [...t])
      next[fromTeam] = next[fromTeam].filter(p => p.id !== player.id)
      next[toTeam] = [...next[toTeam], player]
      return next
    })
  }

  const onDragStart = (p, ti) => { setDragSrc({ player: p, fromTeam: ti }) }
  const onDragEnd = () => { setDragSrc(null); setDragOver(null) }
  const onDragOverPlayer = (e, ti, idx) => { e.preventDefault(); setDragOver({ toTeam: ti, toIdx: idx }) }
  const onDropOnPlayer = (e, ti, idx) => {
    e.preventDefault()
    if (!dragSrc) return
    const { player, fromTeam } = dragSrc
    setTeams(ts => {
      const next = ts.map(t => [...t])
      next[fromTeam] = next[fromTeam].filter(p => p.id !== player.id)
      const insertIdx = fromTeam === ti && idx > ts[fromTeam].findIndex(p => p.id === player.id) ? idx - 1 : idx
      next[ti].splice(Math.min(insertIdx, next[ti].length), 0, player)
      return next
    })
    setDragSrc(null); setDragOver(null)
  }
  const onDropOnTeam = (e, ti) => {
    e.preventDefault()
    if (!dragSrc || dragOver) return
    moveToTeam(dragSrc.player, dragSrc.fromTeam, ti)
    setDragSrc(null); setDragOver(null)
  }

  const removePlayer = (player, fromTeam) => {
    setTeams(ts => { const next = ts.map(t => [...t]); next[fromTeam] = next[fromTeam].filter(p => p.id !== player.id); return next })
  }

  const saveChanges = async () => {
    setBusy(true)
    await onSave(game.id, {
      teams: teams.map(t => t.map(p => ({ name: p.name, positions: p.positions || ['MID'], isGuest: p.isGuest || false }))),
      player_count: teams.flat().length,
    })
    setBusy(false); onClose()
  }

  const tColors = ['#1a4f80', '#7a4d00', '#2a5c0e', '#6a1040']

  return (
    <div className="section">
      <div className="hrow">
        <button className="btn sm" onClick={onClose}>← Back</button>
        <span className="page-title">Adjust teams</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn full" style={{ background: '#2d5509', color: '#fff', borderColor: '#2d5509', flex: 1 }} onClick={reshuffle}>↺ Auto-reshuffle</button>
        <button className="btn" style={{ flex: 1, color: '#1a4f80', borderColor: '#b5d4f4' }} onClick={() => setShowAddPicker(v => !v)}>+ Add player</button>
      </div>

      {showAddPicker && (
        <div style={{ background: '#f0f8ff', border: '1px solid #b5d4f4', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a4f80', marginBottom: 8 }}>Add player from roster — pick team after selecting</div>
          <input value={addQ} onChange={e => setAddQ(e.target.value)} placeholder="🔍 Search roster…" style={{ marginBottom: 8, fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {teams.map((_, ti) => <button key={ti} className={`btn sm${addToTeam === ti ? ' primary' : ''}`} onClick={() => setAddToTeam(ti)} style={{ flex: 1, justifyContent: 'center' }}>Team {LABELS[ti]}</button>)}
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {availablePlayers.length === 0 && <div style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: '10px 0' }}>All roster players already in teams</div>}
            {availablePlayers.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #e8f0fc', cursor: 'pointer' }} onClick={() => addFromRoster(p, addToTeam)}>
                <Av name={p.name} size={24} photo={p.photo_url} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: '#888' }}>★{p.skill}</span>
                {(p.positions || ['MID']).map(pos => <span key={pos} className={`ptag ${pos}`}>{pos}</span>)}
                <span style={{ fontSize: 11, color: '#1a4f80', fontWeight: 600 }}>→ {LABELS[addToTeam]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {teams.map((t, ti) => (
          <div key={ti} style={{ flex: 1, background: ['#ddeeff', '#fff3d9', '#eaf5e0', '#fce8f3'][ti], borderRadius: 8, padding: '6px 10px', textAlign: 'center', border: `1px solid ${['#7ab8ee', '#f0c060', '#8fcc5a', '#e080b0'][ti]}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ['#1a4f80', '#7a4d00', '#2a5c0e', '#6a1040'][ti] }}>Team {LABELS[ti]}</div>
            <div style={{ fontSize: 11, color: '#666' }}>{t.length}P · avg ★{avg(t)}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#f0f8ff', border: '1px solid #b5d4f4', borderRadius: 8, padding: '9px 13px', marginBottom: 12, fontSize: 12, color: '#1a4f80' }}>
        <b>Drag</b> players between teams, or tap <b>→ A/B</b> buttons to move. Tap <b>✕</b> to remove a no-show.
      </div>

      {teams.map((team, ti) => (
        <div key={ti} className={`tbox t${ti}`}
          onDragOver={e => { e.preventDefault() }}
          onDrop={e => onDropOnTeam(e, ti)}
          style={{ minHeight: 80 }}>
          <div className="ttitle">
            <span>TEAM {LABELS[ti]}</span>
            <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.65 }}>avg ★{avg(team)} · {team.length}P</span>
          </div>
          {team.map((p, pi) => {
            const isDragging = dragSrc && dragSrc.player.id === p.id
            const isOver = dragOver && dragOver.toTeam === ti && dragOver.toIdx === pi
            return (
              <div key={p.id}
                draggable
                onDragStart={() => onDragStart(p, ti)}
                onDragEnd={onDragEnd}
                onDragOver={e => onDragOverPlayer(e, ti, pi)}
                onDrop={e => onDropOnPlayer(e, ti, pi)}
                className="tplayer"
                style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab', borderTop: isOver ? `2px solid ${tColors[ti]}` : '2px solid transparent', borderRadius: 6, transition: 'opacity 0.1s' }}>
                <span style={{ color: '#bbb', fontSize: 16, marginRight: 4, cursor: 'grab' }}>⠿</span>
                <Av name={p.name} size={24} photo={p.photo_url} />
                <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{p.name}</span>
                <div style={{ display: 'flex', gap: 3, marginRight: 4 }}>
                  {(p.positions || ['MID']).map(pos => <span key={pos} className={`ptag ${pos}`}>{pos}</span>)}
                </div>
                <span style={{ fontSize: 11, color: '#888', marginRight: 6 }}>★{p.skill}</span>
                {teams.map((t, tIdx) => tIdx !== ti && (
                  <button key={tIdx} className="btn sm"
                    style={{ padding: '2px 6px', fontSize: 10, color: tColors[tIdx], borderColor: tColors[tIdx] + '44', marginRight: 2 }}
                    onClick={e => { e.stopPropagation(); moveToTeam(p, ti, tIdx) }}>
                    →{LABELS[tIdx]}
                  </button>
                ))}
                <button className="btn sm danger" style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={e => { e.stopPropagation(); removePlayer(p, ti) }}>✕</button>
              </div>
            )
          })}
          {team.length === 0 && <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 13, color: '#999', fontStyle: 'italic' }}>Drop players here</div>}
        </div>
      ))}

      <div className="mbtns" style={{ marginTop: 8 }}>
        <button className="btn primary full" onClick={saveChanges} disabled={busy}>{busy ? 'Saving…' : 'Save & republish'}</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
