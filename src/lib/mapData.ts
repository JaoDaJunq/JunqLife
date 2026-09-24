import { supabase } from './supabase'

export type CircleMapLocation = {
  user_id: string
  latitude: number
  longitude: number
  accuracy_m: number | null
  speed_mps: number | null
  heading_deg: number | null
  battery_level: number | null
  recorded_at: string
  received_at: string
}

export type CircleMapMember = {
  userId: string
  displayName: string
  role: 'owner' | 'admin' | 'member'
  sharingEnabled: boolean
  sharingUpdatedAt: string | null
  location: CircleMapLocation | null
}

export type CircleMapState = {
  circle: {
    id: string
    name: string
    owner_id: string
  }
  members: CircleMapMember[]
}

export async function loadCircleMap(circleId: string): Promise<CircleMapState> {
  const { data: circle, error: circleError } = await supabase
    .from('circles')
    .select('id,name,owner_id')
    .eq('id', circleId)
    .single()

  if (circleError) throw circleError

  const { data: memberships, error: membersError } = await supabase
    .from('circle_members')
    .select('user_id,role')
    .eq('circle_id', circleId)
    .order('joined_at', { ascending: true })

  if (membersError) throw membersError

  const userIds = (memberships ?? []).map((member) => member.user_id)

  if (userIds.length === 0) {
    return { circle, members: [] }
  }

  const [profilesResult, sharingResult, locationsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,display_name')
      .in('id', userIds),
    supabase
      .from('circle_member_sharing')
      .select('user_id,sharing_enabled,updated_at')
      .eq('circle_id', circleId),
    supabase
      .from('current_locations')
      .select('user_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,battery_level,recorded_at,received_at')
      .in('user_id', userIds),
  ])

  if (profilesResult.error) throw profilesResult.error
  if (sharingResult.error) throw sharingResult.error
  if (locationsResult.error) throw locationsResult.error

  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
  const sharing = new Map((sharingResult.data ?? []).map((row) => [row.user_id, row]))
  const locations = new Map((locationsResult.data ?? []).map((row) => [row.user_id, row as CircleMapLocation]))

  return {
    circle,
    members: (memberships ?? []).map((member) => ({
      userId: member.user_id,
      displayName: profiles.get(member.user_id)?.display_name ?? 'Membro',
      role: member.role as CircleMapMember['role'],
      sharingEnabled: Boolean(sharing.get(member.user_id)?.sharing_enabled),
      sharingUpdatedAt: sharing.get(member.user_id)?.updated_at ?? null,
      location: locations.get(member.user_id) ?? null,
    })),
  }
}
