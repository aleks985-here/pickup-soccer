import { col, ini } from '../lib/utils'

export default function Av({ name, size = 34, photo }) {
  if (photo) return (
    <div className="av" style={{ width: size, height: size, overflow: 'hidden', borderRadius: '50%', flexShrink: 0 }}>
      <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  )
  return (
    <div className="av" style={{ width: size, height: size, fontSize: size > 28 ? 12 : 10, background: col(name) + '22', color: col(name) }}>
      {ini(name)}
    </div>
  )
}
