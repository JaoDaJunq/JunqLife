import { supabase } from './supabase'

export type ServerDevice = {
  id: string
  label: string | null
  platform: 'android' | 'ios'
  battery_level: number | null
  last_seen_at: string | null
  created_at: string
}

export type ServerLocation = {
  accuracy_m: number | null
  speed_mps: number | null
  battery_level: number | null
  recorded_at: string
  received_at: string
}

export type TrackingServerDiagnostics = {
  devices: ServerDevice[]
  currentLocation: ServerLocation | null
  sharingEnabledCount: number
  sharingTotalCount: number
}

export async function loadTrackingServerDiagnostics(userId: string): Promise<TrackingServerDiagnostics> {
  const [devicesResult, locationResult, sharingResult] = await Promise.all([
    supabase
      .from('devices')
      .select('id,label,platform,battery_level,last_seen_at,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('current_locations')
      .select('accuracy_m,speed_mps,battery_level,recorded_at,received_at')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('circle_member_sharing')
      .select('sharing_enabled')
      .eq('user_id', userId),
  ])

  if (devicesResult.error) throw devicesResult.error
  if (locationResult.error) throw locationResult.error
  if (sharingResult.error) throw sharingResult.error

  const sharingRows = sharingResult.data ?? []

  return {
    devices: (devicesResult.data ?? []) as ServerDevice[],
    currentLocation: (locationResult.data as ServerLocation | null) ?? null,
    sharingEnabledCount: sharingRows.filter((row) => row.sharing_enabled).length,
    sharingTotalCount: sharingRows.length,
  }
}
