import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

type PlaceEvent = {
  id: number
  place_id: string
  circle_id: string
  user_id: string
  event_type: 'entered' | 'exited'
  occurred_at: string
}

type WebhookPayload = {
  type?: string
  table?: string
  record?: PlaceEvent
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

function getSecretKey() {
  const named = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (named) {
    try {
      const parsed = JSON.parse(named) as Record<string, string>
      const key = parsed.default ?? Object.values(parsed)[0]
      if (key) return key
    } catch {
      // Fall through to the legacy environment name.
    }
  }

  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw new Error('missing_supabase_secret_key')
  return key
}

function isPlaceEvent(value: unknown): value is PlaceEvent {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<PlaceEvent>
  return Boolean(
    record.id &&
    record.place_id &&
      record.circle_id &&
      record.user_id &&
      record.occurred_at &&
      (record.event_type === 'entered' || record.event_type === 'exited'),
  )
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const payload = (await request.json()) as WebhookPayload
    if (payload.type !== 'INSERT' || payload.table !== 'place_events' || !isPlaceEvent(payload.record)) {
      return json({ ignored: true })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getSecretKey())
    const { data: event, error: eventError } = await supabase
      .from('place_events')
      .select('id,place_id,circle_id,user_id,event_type,occurred_at')
      .eq('id', payload.record.id)
      .maybeSingle()

    if (eventError) throw eventError
    if (!event) return json({ ignored: true, reason: 'event_not_found' })

    const { error: deliveryError } = await supabase
      .from('place_push_deliveries')
      .insert({ event_id: event.id })

    if (deliveryError?.code === '23505') return json({ sent: 0, reason: 'already_processed' })
    if (deliveryError) throw deliveryError

    const [{ data: place }, { data: actor }, { data: members }] = await Promise.all([
      supabase.from('places').select('name').eq('id', event.place_id).maybeSingle(),
      supabase.from('profiles').select('display_name').eq('id', event.user_id).maybeSingle(),
      supabase.from('circle_members').select('user_id').eq('circle_id', event.circle_id).neq('user_id', event.user_id),
    ])

    const memberIds = (members ?? []).map((member) => member.user_id).filter(Boolean)
    if (!memberIds.length) return json({ sent: 0, reason: 'no_recipients' })

    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .in('user_id', memberIds)

    if (tokenError) throw tokenError
    const recipients = [...new Set((tokens ?? []).map((token) => token.expo_push_token).filter(Boolean))]
    if (!recipients.length) return json({ sent: 0, reason: 'no_registered_devices' })

    const actorName = actor?.display_name || 'Alguém do seu círculo'
    const action = event.event_type === 'entered' ? 'entrou em' : 'saiu de'
    const messages = recipients.map((to) => ({
      to,
      sound: 'default',
      title: 'JunqLife',
      body: `${actorName} ${action} ${place?.name || 'um local salvo'}.`,
      data: { circleId: event.circle_id, placeId: event.place_id, eventType: event.event_type },
    }))

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN')
          ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
          : {}),
      },
      body: JSON.stringify(messages),
    })

    const result = await expoResponse.json()
    if (!expoResponse.ok) return json({ error: 'expo_push_failed', details: result }, 502)
    return json({ sent: recipients.length, result })
  } catch (error) {
    console.error('place-event-push failed', error)
    return json({ error: 'internal_error' }, 500)
  }
})
