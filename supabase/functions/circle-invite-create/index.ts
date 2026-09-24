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

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
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

    const circleId = typeof body.circle_id === 'string' ? body.circle_id : ''
    const expiresHours = typeof body.expires_hours === 'number' ? Math.trunc(body.expires_hours) : 24
    const maxUses = typeof body.max_uses === 'number' ? Math.trunc(body.max_uses) : 10

    if (!/^[0-9a-f-]{36}$/i.test(circleId)) return json({ error: 'invalid_circle_id' }, 400)
    if (expiresHours < 1 || expiresHours > 168) return json({ error: 'invalid_expires_hours' }, 400)
    if (maxUses < 1 || maxUses > 50) return json({ error: 'invalid_max_uses' }, 400)

    const { data: membership, error: memberError } = await userClient
      .from('circle_members')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (memberError) return json({ error: 'membership_check_failed' }, 500)
    if (!membership || !['owner', 'admin'].includes(membership.role)) return json({ error: 'not_allowed' }, 403)

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    for (let attempt = 0; attempt < 4; attempt++) {
      const code = randomCode()
      const codeHash = await sha256(code)
      const { error } = await admin.from('circle_invites').insert({
        circle_id: circleId,
        code_hash: codeHash,
        code_hint: code.slice(-4),
        created_by: auth.user.id,
        expires_at: new Date(Date.now() + expiresHours * 3600_000).toISOString(),
        max_uses: maxUses,
      })

      if (!error) return json({ code, expires_hours: expiresHours, max_uses: maxUses }, 201)
      if (error.code !== '23505') return json({ error: 'invite_create_failed' }, 500)
    }

    return json({ error: 'invite_generation_failed' }, 500)
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})