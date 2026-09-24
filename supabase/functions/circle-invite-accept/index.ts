import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

function getNamedKey(envName: string, fallbackName: string): string {
  const raw = Deno.env.get(envName)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed.default) return parsed.default
      const first = Object.values(parsed)[0]
      if (first) return first
    } catch {}
  }
  const fallback = Deno.env.get(fallbackName)
  if (!fallback) throw new Error('missing_key')
  return fallback
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'missing_user_token' }, 401)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const publishableKey = getNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const secretKey = getNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    const token = authHeader.slice(7)

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: auth, error: authError } = await userClient.auth.getUser(token)
    if (authError || !auth.user) return json({ error: 'invalid_user_token' }, 401)

    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

    const rawCode = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
    if (rawCode.length !== 8) return json({ error: 'invalid_invite' }, 400)

    const codeHash = await sha256(rawCode)
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await admin.rpc('accept_circle_invite_internal', {
      p_user_id: auth.user.id,
      p_code_hash: codeHash,
    })

    if (error) return json({ error: 'invalid_invite' }, 400)
    return json({ circle_id: data })
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})