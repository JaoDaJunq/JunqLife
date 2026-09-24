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

function parseNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const form = await req.formData()
    const deviceAuth = typeof form.get('id') === 'string' ? String(form.get('id')) : ''
    const [deviceId, ingestToken] = deviceAuth.split('.')

    if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !/^[0-9a-f]{64}$/i.test(ingestToken ?? '')) {
      return json({ error: 'invalid_device' }, 401)
    }

    const lat = parseNumber(form.get('lat'))
    const lon = parseNumber(form.get('lon'))
    const timestamp = parseNumber(form.get('timestamp'))
    const accuracy = parseNumber(form.get('accuracy'))
    const altitude = parseNumber(form.get('altitude'))
    const speedKnots = parseNumber(form.get('speed'))
    const bearing = parseNumber(form.get('bearing'))
    const batteryPercent = parseNumber(form.get('batt'))

    if (lat == null || lat < -90 || lat > 90) return json({ error: 'invalid_latitude' }, 400)
    if (lon == null || lon < -180 || lon > 180) return json({ error: 'invalid_longitude' }, 400)
    if (timestamp == null || timestamp <= 0) return json({ error: 'invalid_timestamp' }, 400)
    if (accuracy != null && accuracy < 0) return json({ error: 'invalid_accuracy' }, 400)
    if (bearing != null && (bearing < 0 || bearing > 360)) return json({ error: 'invalid_bearing' }, 400)
    if (batteryPercent != null && (batteryPercent < 0 || batteryPercent > 100)) return json({ error: 'invalid_battery' }, 400)

    const recordedAt = new Date(timestamp * 1000)
    if (!Number.isFinite(recordedAt.getTime())) return json({ error: 'invalid_timestamp' }, 400)
    if (recordedAt.getTime() > Date.now() + 5 * 60_000) return json({ error: 'future_timestamp' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const secretKey = getNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const tokenHash = await sha256(ingestToken)
    const { data: device, error: deviceError } = await admin
      .from('devices')
      .select('id,user_id,ingest_token_hash')
      .eq('id', deviceId)
      .maybeSingle()

    if (deviceError) return json({ error: 'device_check_failed' }, 500)
    if (!device || !device.ingest_token_hash || device.ingest_token_hash !== tokenHash) {
      return json({ error: 'invalid_device' }, 401)
    }

    const { data, error } = await admin.rpc('ingest_location_internal', {
      p_user_id: device.user_id,
      p_device_id: device.id,
      p_latitude: lat,
      p_longitude: lon,
      p_accuracy_m: accuracy,
      p_speed_mps: speedKnots == null ? null : speedKnots / 1.94384,
      p_heading_deg: bearing,
      p_altitude_m: altitude,
      p_battery_level: batteryPercent == null ? null : batteryPercent / 100,
      p_recorded_at: recordedAt.toISOString(),
    })

    if (error) return json({ error: 'location_write_failed' }, 500)

    // Return success even when consent rejects the buffered point so the SDK
    // removes it from its retry queue rather than retaining private data forever.
    return json({ accepted: Boolean(data) })
  } catch {
    return json({ error: 'internal_error' }, 500)
  }
})