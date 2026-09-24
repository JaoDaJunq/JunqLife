import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

type LocationPayload = {
  latitude: number
  longitude: number
  accuracy_m?: number | null
  speed_mps?: number | null
  heading_deg?: number | null
  altitude_m?: number | null
  battery_level?: number | null
  recorded_at: string
  device_id: string
}

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableFiniteNumber(value: unknown): value is number | null | undefined {
  return value == null || isFiniteNumber(value)
}

function validatePayload(input: unknown): { ok: true; value: LocationPayload } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'invalid_payload' }
  }
  const p = input as Record<string, unknown>
  if (!isFiniteNumber(p.latitude) || p.latitude < -90 || p.latitude > 90) return { ok: false, error: 'invalid_latitude' }
  if (!isFiniteNumber(p.longitude) || p.longitude < -180 || p.longitude > 180) return { ok: false, error: 'invalid_longitude' }
  if (!isNullableFiniteNumber(p.accuracy_m) || (typeof p.accuracy_m === 'number' && p.accuracy_m < 0)) return { ok: false, error: 'invalid_accuracy' }
  if (!isNullableFiniteNumber(p.speed_mps) || (typeof p.speed_mps === 'number' && p.speed_mps < 0)) return { ok: false, error: 'invalid_speed' }
  if (!isNullableFiniteNumber(p.heading_deg) || (typeof p.heading_deg === 'number' && (p.heading_deg < 0 || p.heading_deg > 360))) return { ok: false, error: 'invalid_heading' }
  if (!isNullableFiniteNumber(p.altitude_m)) return { ok: false, error: 'invalid_altitude' }
  if (!isNullableFiniteNumber(p.battery_level) || (typeof p.battery_level === 'number' && (p.battery_level < 0 || p.battery_level > 1))) return { ok: false, error: 'invalid_battery' }
  if (typeof p.device_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.device_id)) return { ok: false, error: 'invalid_device_id' }
  if (typeof p.recorded_at !== 'string') return { ok: false, error: 'invalid_recorded_at' }

  const recordedMs = Date.parse(p.recorded_at)
  if (!Number.isFinite(recordedMs)) return { ok: false, error: 'invalid_recorded_at' }
  if (recordedMs > Date.now() + 5 * 60 * 1000) return { ok: false, error: 'recorded_at_in_future' }

  return {
    ok: true,
    value: {
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy_m: p.accuracy_m as number | null | undefined,
      speed_mps: p.speed_mps as number | null | undefined,
      heading_deg: p.heading_deg as number | null | undefined,
      altitude_m: p.altitude_m as number | null | undefined,
      battery_level: p.battery_level as number | null | undefined,
      recorded_at: new Date(recordedMs).toISOString(),
      device_id: p.device_id,
    },
  }
}

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
  if (!fallback) throw new Error(`missing_${envName}`)
  return fallback
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'missing_user_token' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) return json({ error: 'server_configuration_error' }, 500)

  try {
    const publishableKey = getNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
    const secretKey = getNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const token = authHeader.slice('Bearer '.length)
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'invalid_user_token' }, 401)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }

    const parsed = validatePayload(body)
    if (!parsed.ok) return json({ error: parsed.error }, 400)

    const userId = userData.user.id
    const payload = parsed.value

    const { data: device, error: deviceError } = await userClient
      .from('devices')
      .select('id')
      .eq('id', payload.device_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (deviceError) return json({ error: 'device_check_failed' }, 500)
    if (!device) return json({ error: 'device_not_registered' }, 403)

    const { data: sharing, error: sharingError } = await userClient
      .from('circle_member_sharing')
      .select('circle_id')
      .eq('user_id', userId)
      .eq('sharing_enabled', true)
      .limit(1)

    if (sharingError) return json({ error: 'sharing_check_failed' }, 500)
    if (!sharing?.length) return json({ error: 'sharing_disabled' }, 409)

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const common = {
      user_id: userId,
      device_id: payload.device_id,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy_m: payload.accuracy_m ?? null,
      speed_mps: payload.speed_mps ?? null,
      heading_deg: payload.heading_deg ?? null,
      altitude_m: payload.altitude_m ?? null,
      battery_level: payload.battery_level ?? null,
      recorded_at: payload.recorded_at,
    }

    const { error: historyError } = await admin.from('location_history').insert(common)
    if (historyError) return json({ error: 'history_write_failed' }, 500)

    const { data: current, error: currentReadError } = await admin
      .from('current_locations')
      .select('recorded_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (currentReadError) return json({ error: 'current_read_failed' }, 500)

    let currentUpdated = false
    const existingMs = current?.recorded_at ? Date.parse(current.recorded_at) : Number.NEGATIVE_INFINITY
    const incomingMs = Date.parse(payload.recorded_at)

    if (!current || incomingMs >= existingMs) {
      const { error: currentError } = await admin
        .from('current_locations')
        .upsert(common, { onConflict: 'user_id' })

      if (currentError) return json({ error: 'current_write_failed' }, 500)
      currentUpdated = true
    }

    const devicePatch: Record<string, unknown> = { last_seen_at: new Date().toISOString() }
    if (payload.battery_level != null) devicePatch.battery_level = payload.battery_level

    const { error: deviceUpdateError } = await admin
      .from('devices')
      .update(devicePatch)
      .eq('id', payload.device_id)
      .eq('user_id', userId)

    if (deviceUpdateError) return json({ error: 'device_update_failed' }, 500)

    return json({ accepted: true, current_updated: currentUpdated })
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})
