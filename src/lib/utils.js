import { COLORS } from './constants'

export function col(n) {
  let h = 0
  for (let c of (n || 'X')) h = (h + c.charCodeAt(0)) % COLORS.length
  return COLORS[h]
}

export function ini(n) {
  const p = (n || 'X').trim().split(' ')
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : n.slice(0, 2)).toUpperCase()
}

export function genTeams(players, n) {
  const s = [...players].sort((a, b) => b.skill - a.skill)
  const gks = s.filter(p => (p.positions || []).includes('GK'))
  const rest = s.filter(p => !gks.slice(0, n).includes(p))
  const ts = Array.from({ length: n }, () => [])
  gks.slice(0, n).forEach((g, i) => ts[i].push(g))
  rest.forEach((p, i) => {
    const pass = Math.floor(i / n), pos = i % n
    ts[pass % 2 === 0 ? pos : (n - 1 - pos)].push(p)
  })
  const avg = t => t.length ? t.reduce((s, p) => s + p.skill, 0) / t.length : 0
  for (let iter = 0; iter < 50; iter++) {
    let best = 0, si = -1, sj = -1, sti = -1, stj = -1
    for (let ti = 0; ti < n; ti++) for (let tj = ti + 1; tj < n; tj++)
      for (let i = 0; i < ts[ti].length; i++) for (let j = 0; j < ts[tj].length; j++) {
        const cur = Math.abs(avg(ts[ti]) - avg(ts[tj]))
        const ni = [...ts[ti].slice(0, i), ts[tj][j], ...ts[ti].slice(i + 1)]
        const nj = [...ts[tj].slice(0, j), ts[ti][i], ...ts[tj].slice(j + 1)]
        const nd = Math.abs(avg(ni) - avg(nj))
        if (cur - nd > best) { best = cur - nd; si = i; sj = j; sti = ti; stj = tj }
      }
    if (si < 0) break
    const tmp = ts[sti][si]; ts[sti][si] = ts[stj][sj]; ts[stj][sj] = tmp
  }
  return ts
}
