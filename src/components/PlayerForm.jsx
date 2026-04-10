import { useState } from 'react'
import { POSITIONS, SKILL_LABELS, SKILL_DESC } from '../lib/constants'

export default function PlayerForm({ player, onSave, onCancel, busy }) {
  const [f, setF] = useState(player || { name: '', skill: 5, positions: ['MID'] })
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const tog = p => set('positions', f.positions.includes(p) ? f.positions.filter(x => x !== p) : [...f.positions, p])

  return (
    <div>
      <div className="field">
        <label>Name</label>
        <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Player name" autoFocus />
      </div>
      <div className="field">
        <label>Skill rating — <b>{f.skill}/10</b> · <span style={{ color: '#2d5509', fontWeight: 600, fontSize: 13 }}>{SKILL_LABELS[f.skill]}</span></label>
        <div className="srow">
          <input type="range" min="1" max="10" step="1" value={f.skill} onChange={e => set('skill', +e.target.value)} />
          <span className="snum">{f.skill}</span>
        </div>
        <div style={{ fontSize: 12, color: '#777', marginTop: 5, fontStyle: 'italic' }}>{SKILL_DESC[f.skill]}</div>
      </div>
      <div className="field">
        <label style={{ marginBottom: 4 }}>Positions</label>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>First selected = primary · second = secondary</div>
        <div className="pos-grid">
          {POSITIONS.map(p => {
            const idx = f.positions.indexOf(p)
            return (
              <div key={p} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <button className={`pos-chip${f.positions.includes(p) ? ' sel-' + p : ''}`} onClick={() => tog(p)}>{p}</button>
                {idx === 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#2d5509' }}>PRIMARY</span>}
                {idx === 1 && <span style={{ fontSize: 9, color: '#888' }}>2nd</span>}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mbtns">
        <button className="btn primary full" onClick={() => f.name.trim() && onSave(f)} disabled={!f.name.trim() || busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
