import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fwjlwgadoixoegysoyrg.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3amx3Z2Fkb2l4b2VneXNveXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTkzNjcsImV4cCI6MjA5MDAzNTM2N30.LBi4gbqU0LtW9MK_-0faEBdNmc2F0QQI7rT3nfuC7JA'

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
