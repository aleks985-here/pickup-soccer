import { useState, useMemo } from 'react'
import Av from './Av'
import { SKILL_LABELS } from '../lib/constants'

const POSCOLORS = { GK: '#fff0eb', DEF: '#e8f2fc', MID: '#eaf5e0', FWD: '#fef6e4' }
const POSTXT = { GK: '#8b3a1e', DEF: '#1a4f80', MID: '#2a5c0e', FWD: '#7a4d00' }
const POSBORDER = { GK: '#e07b5a', DEF: '#5a9fd4', MID: '#6db33f', FWD: '#e8a820' }

export default function BulkEdit({ players, onUpdate, onClose }) {
  const [edits, setEdits] = useState(() => Object.fromEntries(players.map(p => [p.id, { skill: p.skill, positions: [...(p.positions || ['MID'])] }])))
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState({})
  const filtered = useMemo(() => players.filter(p => p.name.toLowerCase().includes(q.toLowerCase())), [players, q])

  const setSkill = (id, v) => { setEdits(e => ({ ...e, [id]: { ...e[id], skill: +v } })); setDirty(d => ({ ...d, [id]: true })); setSaved(false) }
  const togglePos = (id, pos) => {
    setEdits(e => {
      const cur = e[id].positions
      const next = cur.includes(pos) ? cur.filter(x => x !== pos) : [...cur, pos]
      return { ...e, [id]: { ...e[id], positions: next.length ? next : ['MID'] } }
    })
    setDirty(d => ({ ...d, [id]: true })); setSaved(false)
  }

  const saveAll = async () => {
    setSaving(true)
    const changed = players.filter(p => dirty[p.id])
    await Promise.all(changed.map(p => onUpdate(p.id, { name: p.name, skill: edits[p.id].skill, positions: edits[p.id].positions })))
    setSaving(false); setSaved(true); setDirty({})
  }

  const dirtyCount = Object.keys(dirty).length

  return (
    <div className="section">
      <div className="hrow">
        <button className="btn sm" onClick={onClose}>← Back</button>
        <span className="page-title">Bulk edit</span>
        <span className="count">{players.length} players</span>
      </div>
      <div style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>Tap skill number to change · tap positions to toggle · save when done</div>
      {saved && <div className="alert green" style={{ marginBottom: 10 }}>All changes saved ✓</div>}
      <div style={{ marginBottom: 12 }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍  Search…" /></div>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, marginBottom: 80 }}>
        {filtered.map((p, i) => {
          const e = edits[p.id]
          const isDirty = dirty[p.id]
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < filtered.length - 1 ? '1px solid #f0f0f0' : 'none', background: isDirty ? '#fffdf0' : 'transparent' }}>
              <Av name={p.name} size={30} photo={p.photo_url} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                  {p.name}{isDirty && <span style={{ fontSize: 10, color: '#e8a820', fontWeight: 700, marginLeft: 6 }}>EDITED</span>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {['GK', 'DEF', 'MID', 'FWD'].map(pos => (
                    <button key={pos} onClick={() => togglePos(p.id, pos)} style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1px solid ${e.positions.includes(pos) ? POSBORDER[pos] : '#ddd'}`, background: e.positions.includes(pos) ? POSCOLORS[pos] : '#f9f9f9', color: e.positions.includes(pos) ? POSTXT[pos] : '#aaa' }}>{pos}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button className="btn sm" style={{ padding: '3px 8px', fontSize: 13 }} onClick={() => setSkill(p.id, Math.max(1, e.skill - 1))}>−</button>
                <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#2d5509', minWidth: 18, textAlign: 'center' }}>{e.skill}</span>
                <button className="btn sm" style={{ padding: '3px 8px', fontSize: 13 }} onClick={() => setSkill(p.id, Math.min(10, e.skill + 1))}>+</button>
                <span style={{ fontSize: 10, color: '#888', maxWidth: 64, lineHeight: 1.2, textAlign: 'left' }}>{SKILL_LABELS[e.skill]}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e0e0e0', padding: '12px 16px', display: 'flex', gap: 10, maxWidth: 600, margin: '0 auto', zIndex: 20 }}>
        {dirtyCount > 0
          ? <button className="btn primary full" onClick={saveAll} disabled={saving}>{saving ? 'Saving…' : `Save ${dirtyCount} change${dirtyCount > 1 ? 's' : ''}`}</button>
          : <button className="btn full" onClick={onClose}>Done</button>
        }
      </div>
    </div>
  )
}
