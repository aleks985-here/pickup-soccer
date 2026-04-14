import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fwjlwgadoixoegysoyrg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3amx3Z2Fkb2l4b2VneXNveXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTkzNjcsImV4cCI6MjA5MDAzNTM2N30.LBi4gbqU0LtW9MK_-0faEBdNmc2F0QQI7rT3nfuC7JA'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

async function callEdgeFunction(fnName, body) {
  const { data: { session } } = await sb.auth.getSession()
  const token = session?.access_token
  if (!token) return
  await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(err => console.warn(`${fnName} failed:`, err.message))
}

export const sendEmail = (type, data) => callEdgeFunction('send-email', { type, data })
export const sendTelegram = (type, data) => callEdgeFunction('send-telegram', { type, data })

export async function logActivity({ action, playerName = null, playerId = null, groupId = null, oldValue = null, newValue = null, notes = null }) {
  try {
    const { data: { session } } = await sb.auth.getSession()
    const email = session?.user?.email
    if (!email) return
    await sb.from('activity_log').insert({
      actor_email: email,
      action,
      player_name: playerName,
      player_id: playerId,
      group_id: groupId,
      old_value: oldValue,
      new_value: newValue,
      notes,
    })
  } catch (e) {
    console.warn('logActivity failed:', e.message)
  }
}
