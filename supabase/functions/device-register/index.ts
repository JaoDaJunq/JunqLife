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

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
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

    const platform = body.platform === 'ios' ? 'ios' : body.platform === 'android' ? 'android' : ''
    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : null
    const existingId = typeof body.device_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.device_id) ? body.device_id : null

    if (!platform) return json({ error: 'invalid_platform' }, 400)

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ingestToken = randomToken()
    const ingestTokenHash = await sha256(ingestToken)

    if (existingId) {
      const { data: existing, error: readError } = await admin
        .from('devices').select('id,user_id').eq('id', existingId).maybeSingle()

      if (readError) return json({ error: 'device_lookup_failed' }, 500)
      if (existing && existing.user_id !== auth.user.id) return json({ error: 'device_not_owned' }, 403)

      if (existing) {
        const { error: updateError } = await admin.from('devices').update({
          label,
          platform,
          ingest_token_hash: ingestTokenHash,
          ingest_token_created_at: new Date().toISOString(),
        }).eq('id', existingId).eq('user_id', auth.user.id)

        if (updateError) return json({ error: 'device_update_failed' }, 500)
        return json({ device_id: existingId, ingest_token: ingestToken })
      }
    }

    const { data: created, error: insertError } = await admin.from('devices').insert({
      user_id: auth.user.id,
      label,
      platform,
      ingest_token_hash: ingestTokenHash,
      ingest_token_created_at: new Date().toISOString(),
    }).select('id').single()

    if (insertError || !created) return json({ error: 'device_create_failed' }, 500)

    return json({ device_id: created.id, ingest_token: ingestToken }, 201)
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})