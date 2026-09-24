import { supabase } from './supabase'

export type HistoryPoint = {
  id: number
  latitude: number
  longitude: number
  accuracy_m: number | null
  speed_mps: number | null
  heading_deg: number | null
  battery_level: number | null
  recorded_at: string
}

export type HistorySummary = {
  points: HistoryPoint[]
  distanceKm: number
  startedAt: string | null
  endedAt: string | null
}

function dayBoundsLocal(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return { start, end }
}

function haversineKm(a: HistoryPoint, b: HistoryPoint) {
  const earthRadiusKm = 6371
  const toRadians = (value: number) => (value * Math.PI) / 180
  const dLat = toRadians(b.latitude - a.latitude)
  const dLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h))
}

function summarize(points: HistoryPoint[]): HistorySummary {
  const usable = points.filter(
    (point) => point.accuracy_m == null || point.accuracy_m <= 200,
  )

  let distanceKm = 0
  for (let index = 1; index < usable.length; index += 1) {
    const segment = haversineKm(usable[index - 1], usable[index])

    // Discard obvious GPS jumps for the MVP summary.
    if (segment <= 5) {
      distanceKm += segment
    }
  }

  return {
    points: usable,
    distanceKm,
    startedAt: usable[0]?.recorded_at ?? null,
    endedAt: usable.at(-1)?.recorded_at ?? null,
  }
}

export async function loadTodayHistory(circleId: string, targetUserId: string) {
  const { start, end } = dayBoundsLocal()

  const { data, error } = await supabase.rpc('get_circle_history', {
    p_circle_id: circleId,
    p_target_user_id: targetUserId,
    p_start_at: start.toISOString(),
    p_end_at: end.toISOString(),
    p_limit: 2500,
  })

  if (error) throw error
  return summarize((data ?? []) as HistoryPoint[])
}
