import { useState } from 'react'
import Av from './Av'
import AdjustGame from './AdjustGame'
import { LABELS } from '../lib/constants'

function ScoreModal({ game, onSave, onClose }) {
  const [sc, setSc] = useState({ ...(game.scores || {}) })
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Score — {game.game_date}</h2>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          {(game.teams || []).map((t, ti) => (
            <div key={ti} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6, fontWeight: 600 }}>TEAM {LABELS[ti]}</div>
              <input type="number" min="0" value={sc[ti] ?? ''} onChange={e => setSc(s => ({ ...s, [ti]: e.target.value }))} style={{ width: 60, textAlign: 'center', fontSize: 22, fontWeight: 700, padding: '6px 4px' }} />
            </div>
          ))}
        </div>
        <div className="mbtns">
          <button className="btn primary full" onClick={() => onSave(sc)}>Save score</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function History({ games, players, isAdmin, canDelete, onUpdateGame, onDeleteGame }) {
  const [scoreModal, setScoreModal] = useState(null)
  const [adjustGame, setAdjustGame] = useState(null)

  const saveScore = async (id, sc) => {
    await onUpdateGame(id, { scores: Object.keys(sc).reduce((a, k) => ({ ...a, [k]: +sc[k] || 0 }), {}) })
    setScoreModal(null)
  }
  const del = async id => { if (!window.confirm('Delete this game?')) return; await onDeleteGame(id) }

  const getName = p => typeof p === 'string' ? p : p.name

  if (adjustGame) return (
    <AdjustGame
      game={adjustGame}
      players={players}
      onSave={async (id, data) => { await onUpdateGame(id, data); setAdjustGame(null) }}
      onClose={() => setAdjustGame(null)}
    />
  )

  if (!games.length) return (
    <div className="section">
      <div className="page-title" style={{ marginBottom: 14 }}>History</div>
      <div className="empty"><div className="icon">📋</div><div className="title">No games yet</div><p style={{ fontSize: 14 }}>Generate and save a game to start</p></div>
    </div>
  )

  const uniq = new Set(games.flatMap(g => (g.teams || []).flat().map(getName))).size
  return (
    <div className="section">
      <div className="hrow"><span className="page-title">History</span><span className="count">{games.length} games</span></div>
      <div className="stats3">
        <div className="statbox"><div className="statv">{games.length}</div><div className="statl">Games</div></div>
        <div className="statbox"><div className="statv">{uniq}</div><div className="statl">Players</div></div>
        <div className="statbox"><div className="statv">{Math.round(games.reduce((s, g) => s + (g.player_count || 0), 0) / games.length)}</div><div className="statl">Avg size</div></div>
      </div>
      <div className="card-wrap">
        {games.map((g, gi) => (
          <div key={g.id} className="gitem">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#888', fontWeight: 600 }}>{g.game_date} · {g.player_count}P</span>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {gi === 0 && <button className="btn sm" style={{ color: '#7a4d00', borderColor: '#f0c060' }} onClick={() => setAdjustGame(g)}>✏️ Adjust</button>}
                  <button className="btn sm" onClick={() => setScoreModal(g)}>+ Score</button>
                  {canDelete && <button className="btn sm danger" onClick={() => del(g.id)}>✕</button>}
                </div>
              )}
            </div>
            {(g.teams || []).map((t, ti) => (
              <div key={ti} style={{ fontSize: 12, marginBottom: 3, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <b style={{ minWidth: 14, color: ['#1a4f80', '#7a4d00', '#2a5c0e', '#6a1040'][ti] || '#333', flexShrink: 0 }}>{'ABCD'[ti]}</b>
                {g.scores && g.scores[ti] !== undefined && g.scores[ti] !== 0 && <b style={{ color: ['#1a4f80', '#7a4d00', '#2a5c0e', '#6a1040'][ti] || '#333', minWidth: 14, flexShrink: 0 }}>{g.scores[ti]}</b>}
                <span style={{ color: '#555' }}>{t.map(getName).join(', ')}</span>
              </div>
            ))}
            {g.subs && g.subs.length > 0 && <div style={{ marginTop: 5, fontSize: 11, color: '#888' }}>🔄 {g.subs.map((s, i) => `${s.out}→${s.in}`).join(', ')}</div>}
          </div>
        ))}
      </div>
      {scoreModal && <ScoreModal game={scoreModal} onSave={sc => saveScore(scoreModal.id, sc)} onClose={() => setScoreModal(null)} />}
    </div>
  )
}
