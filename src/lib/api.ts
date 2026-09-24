import { supabase } from './supabase'

export type Circle = {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export async function listCircles() {
  const { data, error } = await supabase
    .from('circles')
    .select('id,name,owner_id,created_at')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Circle[]
}

export async function createCircle(name: string, userId: string) {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Dê um nome para o círculo.')

  const { data, error } = await supabase
    .from('circles')
    .insert({ name: cleanName, owner_id: userId })
    .select('id,name,owner_id,created_at')
    .single()

  if (error) throw error
  return data as Circle
}

export async function createInvite(circleId: string) {
  const { data, error } = await supabase.functions.invoke('circle-invite-create', {
    body: {
      circle_id: circleId,
      expires_hours: 24,
      max_uses: 10,
    },
  })

  if (error) throw error
  if (!data?.code) throw new Error('Não foi possível gerar o convite.')
  return data.code as string
}

export async function acceptInvite(rawCode: string) {
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 8) throw new Error('O código precisa ter 8 caracteres.')

  const { data, error } = await supabase.functions.invoke('circle-invite-accept', {
    body: { code },
  })

  if (error) throw error
  if (!data?.circle_id) throw new Error('Convite inválido ou expirado.')
  return data.circle_id as string
}

export async function setSharing(circleId: string, userId: string, enabled: boolean) {
  const { error } = await supabase
    .from('circle_member_sharing')
    .update({ sharing_enabled: enabled })
    .eq('circle_id', circleId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getSharing(circleId: string, userId: string) {
  const { data, error } = await supabase
    .from('circle_member_sharing')
    .select('sharing_enabled')
    .eq('circle_id', circleId)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return Boolean(data.sharing_enabled)
}


export type Place = {
  id: string
  circle_id: string
  name: string
  latitude: number
  longitude: number
  radius_m: number
  created_by: string
  created_at: string
}

export async function listPlaces(circleId: string) {
  const { data, error } = await supabase
    .from('places')
    .select('id,circle_id,name,latitude,longitude,radius_m,created_by,created_at')
    .eq('circle_id', circleId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Place[]
}

export async function createPlace(input: {
  circleId: string
  name: string
  latitude: number
  longitude: number
  radiusM: number
  userId: string
}) {
  const cleanName = input.name.trim()
  if (!cleanName) throw new Error('Dê um nome para o local.')

  const radiusM = Math.round(input.radiusM)
  if (!Number.isFinite(radiusM) || radiusM < 25 || radiusM > 5000) {
    throw new Error('O raio precisa ficar entre 25 e 5000 metros.')
  }

  const { data, error } = await supabase
    .from('places')
    .insert({
      circle_id: input.circleId,
      name: cleanName,
      latitude: input.latitude,
      longitude: input.longitude,
      radius_m: radiusM,
      created_by: input.userId,
    })
    .select('id,circle_id,name,latitude,longitude,radius_m,created_by,created_at')
    .single()

  if (error) throw error
  return data as Place
}

export async function deletePlace(placeId: string) {
  const { error } = await supabase
    .from('places')
    .delete()
    .eq('id', placeId)

  if (error) throw error
}


export type CircleMemberRole = 'owner' | 'admin' | 'member'

export type CircleMemberDetails = {
  circleId: string
  userId: string
  role: CircleMemberRole
  joinedAt: string
  displayName: string
  avatarPath: string | null
}

export async function listCircleMembers(circleId: string) {
  const { data: memberships, error: membershipsError } = await supabase
    .from('circle_members')
    .select('circle_id,user_id,role,joined_at')
    .eq('circle_id', circleId)
    .order('joined_at', { ascending: true })

  if (membershipsError) throw membershipsError
  if (!memberships?.length) return [] as CircleMemberDetails[]

  const userIds = memberships.map((membership) => membership.user_id)

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id,display_name,avatar_path')
    .in('id', userIds)

  if (profilesError) throw profilesError

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile] as const),
  )

  return memberships.map((membership) => {
    const profile = profileById.get(membership.user_id)
    return {
      circleId: membership.circle_id,
      userId: membership.user_id,
      role: membership.role as CircleMemberRole,
      joinedAt: membership.joined_at,
      displayName: profile?.display_name ?? 'Membro',
      avatarPath: profile?.avatar_path ?? null,
    }
  }) as CircleMemberDetails[]
}

export async function removeCircleMember(circleId: string, userId: string) {
  const { error } = await supabase
    .from('circle_members')
    .delete()
    .eq('circle_id', circleId)
    .eq('user_id', userId)

  if (error) throw error
}


export async function setCircleMemberRole(
  circleId: string,
  userId: string,
  role: Extract<CircleMemberRole, 'admin' | 'member'>,
) {
  const { data, error } = await supabase.functions.invoke('circle-member-role', {
    body: {
      circle_id: circleId,
      user_id: userId,
      role,
    },
  })

  if (error) throw error
  if (!data?.user_id || !data?.role) {
    throw new Error('Não foi possível alterar o papel deste membro.')
  }

  return {
    userId: String(data.user_id),
    role: data.role as Extract<CircleMemberRole, 'admin' | 'member'>,
  }
}


export type Profile = {
  id: string
  display_name: string
  avatar_path: string | null
  created_at: string
  updated_at: string
}

export async function getMyProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,display_name,avatar_path,created_at,updated_at')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data as Profile
}

export async function updateMyProfile(userId: string, displayName: string) {
  const cleanName = displayName.trim()
  if (cleanName.length < 2) throw new Error('Use pelo menos 2 caracteres no nome.')
  if (cleanName.length > 80) throw new Error('Use no máximo 80 caracteres no nome.')

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: cleanName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id,display_name,avatar_path,created_at,updated_at')
    .single()

  if (error) throw error
  return data as Profile
}
