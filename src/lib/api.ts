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
