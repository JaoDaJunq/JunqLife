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
    const targetUserId = typeof body.user_id === 'string' ? body.user_id : ''
    const role = body.role === 'admin' || body.role === 'member' ? body.role : ''

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidPattern.test(circleId)) return json({ error: 'invalid_circle_id' }, 400)
    if (!uuidPattern.test(targetUserId)) return json({ error: 'invalid_user_id' }, 400)
    if (!role) return json({ error: 'invalid_role' }, 400)
    if (targetUserId === auth.user.id) return json({ error: 'cannot_change_own_role' }, 400)

    const { data: callerMembership, error: callerError } = await userClient
      .from('circle_members')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (callerError) return json({ error: 'membership_check_failed' }, 500)
    if (callerMembership?.role !== 'owner') return json({ error: 'owner_required' }, 403)

    const { data: targetMembership, error: targetError } = await userClient
      .from('circle_members')
      .select('role')
      .eq('circle_id', circleId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetError) return json({ error: 'target_membership_check_failed' }, 500)
    if (!targetMembership) return json({ error: 'member_not_found' }, 404)
    if (targetMembership.role === 'owner') return json({ error: 'owner_role_protected' }, 400)

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: updated, error: updateError } = await admin
      .from('circle_members')
      .update({ role })
      .eq('circle_id', circleId)
      .eq('user_id', targetUserId)
      .neq('role', 'owner')
      .select('user_id,role')
      .maybeSingle()

    if (updateError) return json({ error: 'role_update_failed' }, 500)
    if (!updated) return json({ error: 'member_not_updated' }, 409)

    return json({ user_id: updated.user_id, role: updated.role })
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})
