import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers })

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'missing_user_token' }, 401)
  }

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
    try {
      body = await req.json()
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }

    const circleId = typeof body.circle_id === 'string' ? body.circle_id : ''
    const newOwnerId = typeof body.new_owner_id === 'string' ? body.new_owner_id : ''

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidPattern.test(circleId)) return json({ error: 'invalid_circle_id' }, 400)
    if (!uuidPattern.test(newOwnerId)) return json({ error: 'invalid_new_owner_id' }, 400)
    if (newOwnerId === auth.user.id) return json({ error: 'new_owner_must_be_different' }, 400)

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await admin.rpc('transfer_circle_ownership_internal', {
      p_circle_id: circleId,
      p_current_owner_id: auth.user.id,
      p_new_owner_id: newOwnerId,
    })

    if (error) {
      const message = String(error.message ?? '').toLowerCase()
      if (message.includes('current owner mismatch')) return json({ error: 'owner_required' }, 403)
      if (message.includes('new owner must already')) return json({ error: 'member_required' }, 400)
      if (message.includes('circle not found')) return json({ error: 'circle_not_found' }, 404)
      return json({ error: 'transfer_failed' }, 500)
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result?.transferred_circle_id) return json({ error: 'transfer_failed' }, 500)

    return json({
      circle_id: result.transferred_circle_id,
      old_owner_id: result.old_owner_id,
      new_owner_id: result.new_owner_id,
    })
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})
