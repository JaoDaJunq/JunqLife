import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import CircleMap from '@/src/components/CircleMap'
import {
  loadCircleMap,
  type CircleMapLocation,
  type CircleMapState,
} from '@/src/lib/mapData'
import { supabase } from '@/src/lib/supabase'
import { useAuth } from '@/src/context/AuthProvider'

function relativeTime(value: string, now: number) {
  const diffSeconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000))
  if (diffSeconds < 45) return 'agora'
  if (diffSeconds < 3600) return `há ${Math.floor(diffSeconds / 60)} min`
  if (diffSeconds < 86400) return `há ${Math.floor(diffSeconds / 3600)} h`
  return new Date(value).toLocaleString()
}

function movementLabel(location: CircleMapLocation | null) {
  if (!location) return 'Sem posição'
  const kmh = Math.max(0, (location.speed_mps ?? 0) * 3.6)
  if (kmh >= 4) return `Em movimento · ${Math.round(kmh)} km/h`
  return 'Parado'
}

export default function CircleMapScreen() {
  const params = useLocalSearchParams<{ circleId?: string | string[] }>()
  const circleId = Array.isArray(params.circleId) ? params.circleId[0] : params.circleId
  const { user } = useAuth()

  const [state, setState] = useState<CircleMapState | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const refresh = useCallback(async () => {
    if (!circleId) return
    try {
      const next = await loadCircleMap(circleId)
      setState(next)
      setSelectedUserId((current) => current ?? user?.id ?? next.members[0]?.userId ?? null)
    } catch (error) {
      Alert.alert('Não foi possível abrir o mapa', error instanceof Error ? error.message : 'Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [circleId, user?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!circleId) return

    const channel = supabase
      .channel(`junqlife-circle-map:${circleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'current_locations' },
        (payload) => {
          const row = payload.new as unknown as CircleMapLocation
          if (!row?.user_id) return

          setState((current) => {
            if (!current || !current.members.some((member) => member.userId === row.user_id)) return current

            return {
              ...current,
              members: current.members.map((member) =>
                member.userId === row.user_id ? { ...member, location: row } : member,
              ),
            }
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'circle_member_sharing',
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          const row = payload.new as unknown as {
            user_id?: string
            sharing_enabled?: boolean
            updated_at?: string
          }
          if (!row.user_id) return

          setState((current) => {
            if (!current) return current
            return {
              ...current,
              members: current.members.map((member) =>
                member.userId === row.user_id
                  ? {
                      ...member,
                      sharingEnabled: Boolean(row.sharing_enabled),
                      sharingUpdatedAt: row.updated_at ?? member.sharingUpdatedAt,
                    }
                  : member,
              ),
            }
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [circleId])

  const selectedMember = useMemo(
    () => state?.members.find((member) => member.userId === selectedUserId) ?? null,
    [state, selectedUserId],
  )

  if (!circleId) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.errorTitle}>Círculo inválido</Text>
        <Pressable onPress={() => router.back()}><Text style={styles.link}>Voltar</Text></Pressable>
      </SafeAreaView>
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  if (!state || !user) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.errorTitle}>Não foi possível carregar o círculo.</Text>
        <Pressable onPress={() => router.back()}><Text style={styles.link}>Voltar</Text></Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>MAPA AO VIVO</Text>
            <Text style={styles.heading}>{state.circle.name}</Text>
          </View>

          <Pressable onPress={refresh}>
            <Text style={styles.link}>Atualizar</Text>
          </Pressable>
        </View>

        <CircleMap
          members={state.members}
          currentUserId={user.id}
          selectedUserId={selectedUserId}
          onMemberPress={setSelectedUserId}
        />

        {selectedMember && (
          <View style={styles.selectedCard}>
            <View style={styles.memberHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {selectedMember.displayName.trim().slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.selectedName}>
                  {selectedMember.displayName}{selectedMember.userId === user.id ? ' · Você' : ''}
                </Text>
                <Text style={styles.selectedStatus}>
                  {selectedMember.userId !== user.id && !selectedMember.sharingEnabled
                    ? 'Compartilhamento pausado neste círculo'
                    : movementLabel(selectedMember.location)}
                </Text>
              </View>
            </View>

            {selectedMember.location && (selectedMember.userId === user.id || selectedMember.sharingEnabled) ? (
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>ÚLTIMA POSIÇÃO</Text>
                  <Text style={styles.statValue}>{relativeTime(selectedMember.location.recorded_at, now)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>BATERIA</Text>
                  <Text style={styles.statValue}>
                    {selectedMember.location.battery_level == null
                      ? '—'
                      : `${Math.round(selectedMember.location.battery_level * 100)}%`}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>PRECISÃO</Text>
                  <Text style={styles.statValue}>
                    {selectedMember.location.accuracy_m == null
                      ? '—'
                      : `±${Math.round(selectedMember.location.accuracy_m)} m`}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.pausedText}>
                {selectedMember.userId === user.id
                  ? 'Você ainda não enviou uma posição neste aparelho.'
                  : 'A última posição não é exibida enquanto este membro estiver pausado neste círculo.'}
              </Text>
            )}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Membros</Text>
          <Text style={styles.memberCount}>{state.members.length}</Text>
        </View>

        {state.members.map((member) => {
          const canShow = member.userId === user.id || member.sharingEnabled
          const location = canShow ? member.location : null

          return (
            <Pressable
              key={member.userId}
              style={[
                styles.memberCard,
                selectedUserId === member.userId && styles.memberCardSelected,
              ]}
              onPress={() => setSelectedUserId(member.userId)}
            >
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarSmallText}>{member.displayName.trim().slice(0, 2).toUpperCase()}</Text>
              </View>

              <View style={styles.flex}>
                <Text style={styles.memberName}>
                  {member.displayName}{member.userId === user.id ? ' · Você' : ''}
                </Text>
                <Text style={styles.memberMeta}>
                  {!canShow
                    ? 'Localização pausada'
                    : location
                      ? `${movementLabel(location)} · ${relativeTime(location.recorded_at, now)}`
                      : 'Aguardando primeira posição'}
                </Text>
              </View>

              <View style={[styles.onlineDot, canShow && location && styles.onlineDotActive]} />
            </Pressable>
          )
        })}

        <Text style={styles.privacyNote}>
          O mapa só exibe localização de membros que autorizaram compartilhamento neste círculo. Sua própria posição continua visível para você.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  page: { padding: 18, paddingBottom: 50, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 30, color: '#161C21', lineHeight: 32, marginTop: -2 },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: '#77818A' },
  heading: { fontSize: 25, fontWeight: '900', color: '#11161A', marginTop: 2 },
  link: { color: '#356AE6', fontWeight: '800' },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#1B2228' },
  selectedCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 16 },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#101418', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  selectedName: { fontSize: 19, fontWeight: '900', color: '#171D22' },
  selectedStatus: { color: '#68737D', marginTop: 3 },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: '#F3F5F7', borderRadius: 14, padding: 12 },
  statLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7, color: '#7C8790' },
  statValue: { fontSize: 15, fontWeight: '800', color: '#20272D', marginTop: 4 },
  pausedText: { color: '#6B7680', lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#171D22' },
  memberCount: { minWidth: 28, textAlign: 'center', backgroundColor: '#E7EAED', color: '#56616B', borderRadius: 999, paddingVertical: 4, fontWeight: '800' },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: 'transparent' },
  memberCardSelected: { borderColor: '#9CB7F5' },
  avatarSmall: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8EDF2', alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { color: '#34404A', fontWeight: '900', fontSize: 12 },
  memberName: { color: '#1C2329', fontWeight: '800', fontSize: 15 },
  memberMeta: { color: '#7A858E', fontSize: 13, marginTop: 3 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C8CFD4' },
  onlineDotActive: { backgroundColor: '#20A760' },
  privacyNote: { color: '#7A858E', fontSize: 12, lineHeight: 18, paddingHorizontal: 4, marginTop: 4 },
  flex: { flex: 1 },
})
