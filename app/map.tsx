import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import CircleMap from '@/src/components/CircleMap'
import {
  loadCircleMap,
  type CircleMapLocation,
  type CircleMapState,
} from '@/src/lib/mapData'
import { loadTodayHistory, type HistorySummary } from '@/src/lib/history'
import { supabase } from '@/src/lib/supabase'
import { useAuth } from '@/src/context/AuthProvider'
import { notifyPlaceEvent } from '@/src/lib/notifications'
import {
  createPlace,
  deletePlace,
  getAvatarPublicUrl,
  listPlaceEvents,
  listPlaces,
  type Place,
  type PlaceEvent,
} from '@/src/lib/api'

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
  const [history, setHistory] = useState<HistorySummary | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [places, setPlaces] = useState<Place[]>([])
  const [placeEvents, setPlaceEvents] = useState<PlaceEvent[]>([])
  const [placeName, setPlaceName] = useState('')
  const [placeRadius, setPlaceRadius] = useState('100')
  const [placeBusy, setPlaceBusy] = useState(false)
  const [placeDraft, setPlaceDraft] = useState<[number, number] | null>(null)
  const placesRef = useRef<Place[]>([])
  const membersRef = useRef<CircleMapState['members']>([])

  const refresh = useCallback(async () => {
    if (!circleId) return
    try {
      const [next, nextPlaces, nextEvents] = await Promise.all([
        loadCircleMap(circleId),
        listPlaces(circleId),
        listPlaceEvents(circleId),
      ])
      setState(next)
      setPlaces(nextPlaces)
      setPlaceEvents(nextEvents)
      placesRef.current = nextPlaces
      membersRef.current = next.members
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
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'place_events',
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          const event = payload.new as unknown as PlaceEvent
          if (!event?.id) return
          const place = placesRef.current.find((item) => item.id === event.place_id)
          const member = membersRef.current.find((item) => item.userId === event.user_id)
          if (place && member) {
            void notifyPlaceEvent({
              placeName: place.name,
              memberName: member.displayName,
              eventType: event.event_type,
            }).catch(() => undefined)
          }
          setPlaceEvents((current) => [
            event,
            ...current.filter((item) => item.id !== event.id),
          ].slice(0, 20))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [circleId])

  useEffect(() => {
    if (!circleId || !selectedUserId) {
      setHistory(null)
      return
    }

    let cancelled = false
    setHistoryLoading(true)

    loadTodayHistory(circleId, selectedUserId)
      .then((next) => {
        if (!cancelled) setHistory(next)
      })
      .catch(() => {
        if (!cancelled) setHistory(null)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [circleId, selectedUserId])

  const selectedMember = useMemo(
    () => state?.members.find((member) => member.userId === selectedUserId) ?? null,
    [state, selectedUserId],
  )

  const isOwner = Boolean(user && state?.circle.owner_id === user.id)

  const selectedLocation = useMemo(() => {
    if (!selectedMember?.location) return null
    if (selectedMember.userId === user?.id || selectedMember.sharingEnabled) {
      return selectedMember.location
    }
    return null
  }, [selectedMember, user?.id])

  const placeCoordinate = useMemo<[number, number] | null>(() => {
    if (placeDraft) return placeDraft
    if (selectedLocation) return [selectedLocation.longitude, selectedLocation.latitude]
    return null
  }, [placeDraft, selectedLocation])

  const handleCreatePlace = async () => {
    if (!circleId || !user || !placeCoordinate || placeBusy) return

    const radiusM = Number(placeRadius.replace(',', '.'))
    setPlaceBusy(true)
    try {
      const place = await createPlace({
        circleId,
        name: placeName,
        latitude: placeCoordinate[1],
        longitude: placeCoordinate[0],
        radiusM,
        userId: user.id,
      })
      setPlaces((current) => {
        const next = [...current, place]
        placesRef.current = next
        return next
      })
      setPlaceName('')
      setPlaceRadius('100')
      setPlaceDraft(null)
      Alert.alert('Local salvo', `${place.name} agora aparece no mapa deste círculo.`)
    } catch (error) {
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.')
    } finally {
      setPlaceBusy(false)
    }
  }

  const handleDeletePlace = async (place: Place) => {
    if (placeBusy) return

    Alert.alert(
      'Excluir local?',
      `Remover “${place.name}” deste círculo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setPlaceBusy(true)
            try {
              await deletePlace(place.id)
              setPlaces((current) => {
                const next = current.filter((item) => item.id !== place.id)
                placesRef.current = next
                return next
              })
            } catch (error) {
              Alert.alert('Não foi possível excluir', error instanceof Error ? error.message : 'Tente novamente.')
            } finally {
              setPlaceBusy(false)
            }
          },
        },
      ],
    )
  }

  const routeCoordinates = useMemo(
    () => history?.points.map((point) => [point.longitude, point.latitude] as [number, number]) ?? [],
    [history],
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

      <View style={styles.mapShell}>
        <CircleMap
          members={state.members}
          currentUserId={user.id}
          selectedUserId={selectedUserId}
          routeCoordinates={routeCoordinates}
          places={places}
          draftCoordinate={isOwner ? placeDraft : null}
          onMemberPress={setSelectedUserId}
          onMapLongPress={isOwner ? setPlaceDraft : undefined}
        />
      </View>

      <ScrollView
        style={styles.detailsScroll}
        contentContainerStyle={styles.detailsPage}
        keyboardShouldPersistTaps="handled"
      >
        {selectedMember && (
          <View style={styles.selectedCard}>
            <View style={styles.memberHeader}>
              {getAvatarPublicUrl(selectedMember.avatarPath) ? (
                <Image
                  source={{ uri: getAvatarPublicUrl(selectedMember.avatarPath)! }}
                  style={styles.avatarPhoto}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {selectedMember.displayName.trim().slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
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

            {historyLoading ? (
              <Text style={styles.pausedText}>Carregando histórico de hoje...</Text>
            ) : history && history.points.length > 0 ? (
              <View style={styles.historyRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>HOJE</Text>
                  <Text style={styles.statValue}>{history.points.length} pontos</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>DISTÂNCIA</Text>
                  <Text style={styles.statValue}>{history.distanceKm.toFixed(1)} km</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>ROTA</Text>
                  <Text style={styles.statValue}>{history.points.length >= 2 ? 'No mapa' : '1 ponto'}</Text>
                </View>
              </View>
            ) : null}

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

        {isOwner && placeCoordinate && (
          <View style={styles.placeCreateCard}>
            <View style={styles.placeCreateHeader}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>Salvar local</Text>
                <Text style={styles.placeHelp}>
                  {placeDraft
                    ? 'Ponto escolhido diretamente no mapa.'
                    : 'Usando a posição do membro selecionado. Segure no mapa para escolher outro ponto.'}
                </Text>
              </View>
              {placeDraft && (
                <Pressable onPress={() => setPlaceDraft(null)}>
                  <Text style={styles.link}>Cancelar ponto</Text>
                </Pressable>
              )}
            </View>
            <TextInput
              value={placeName}
              onChangeText={setPlaceName}
              placeholder="Ex.: Casa, Trabalho, Academia"
              style={styles.input}
              maxLength={100}
            />
            <TextInput
              value={placeRadius}
              onChangeText={setPlaceRadius}
              placeholder="Raio em metros"
              keyboardType="numeric"
              style={styles.input}
            />
            <Pressable
              onPress={handleCreatePlace}
              disabled={placeBusy}
              style={[styles.primaryButton, placeBusy && styles.buttonDisabled]}
            >
              <Text style={styles.primaryButtonText}>
                {placeBusy ? 'Salvando...' : 'Salvar local'}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Locais salvos</Text>
          <Text style={styles.memberCount}>{places.length}</Text>
        </View>

        {places.length === 0 ? (
          <View style={styles.emptyPlaceCard}>
            <Text style={styles.emptyPlaceTitle}>Nenhum local salvo</Text>
            <Text style={styles.emptyPlaceText}>
              {isOwner
                ? 'Segure no mapa para escolher onde criar o primeiro local.'
                : 'O owner do círculo ainda não cadastrou nenhum local.'}
            </Text>
          </View>
        ) : (
          places.map((place) => (
            <View key={place.id} style={styles.placeCard}>
              <View style={styles.placeIcon}><Text style={styles.placeIconText}>⌂</Text></View>
              <View style={styles.flex}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeMeta}>Raio de {place.radius_m} m</Text>
              </View>
              {isOwner && (
                <Pressable onPress={() => handleDeletePlace(place)} disabled={placeBusy}>
                  <Text style={styles.deleteLink}>Excluir</Text>
                </Pressable>
              )}
            </View>
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Atividade dos locais</Text>
          <Text style={styles.memberCount}>{placeEvents.length}</Text>
        </View>

        {placeEvents.length === 0 ? (
          <View style={styles.emptyPlaceCard}>
            <Text style={styles.emptyPlaceTitle}>Nenhuma entrada ou saída registrada</Text>
            <Text style={styles.emptyPlaceText}>
              Quando um membro entrar ou sair de um local, o evento aparecerá aqui.
            </Text>
          </View>
        ) : (
          placeEvents.map((event) => {
            const place = places.find((item) => item.id === event.place_id)
            const member = state.members.find((item) => item.userId === event.user_id)
            const entered = event.event_type === 'entered'
            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={[styles.eventIcon, entered ? styles.eventEntered : styles.eventExited]}>
                  <Text style={styles.eventIconText}>{entered ? '↓' : '↑'}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.eventTitle}>
                    {member?.displayName ?? 'Membro'} {entered ? 'entrou em' : 'saiu de'} {place?.name ?? 'um local'}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {new Date(event.occurred_at).toLocaleString()} · precisão {event.accuracy_m == null ? '—' : `±${Math.round(event.accuracy_m)} m`}
                  </Text>
                </View>
              </View>
            )
          })
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
              {getAvatarPublicUrl(member.avatarPath) ? (
                <Image
                  source={{ uri: getAvatarPublicUrl(member.avatarPath)! }}
                  style={styles.avatarSmallPhoto}
                />
              ) : (
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>{member.displayName.trim().slice(0, 2).toUpperCase()}</Text>
                </View>
              )}

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
  safe: { flex: 1, backgroundColor: '#FAF7EF' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },
  mapShell: { paddingHorizontal: 18, paddingBottom: 12 },
  detailsScroll: { flex: 1 },
  detailsPage: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 50, gap: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 30, color: '#4B1F5B', lineHeight: 32, marginTop: -2 },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: '#7A3B8F' },
  heading: { fontSize: 25, fontWeight: '900', color: '#24172B', marginTop: 2 },
  link: { color: '#7A3B8F', fontWeight: '800' },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#1B2228' },
  selectedCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 16 },
  placeCreateCard: { backgroundColor: '#F4EFF6', borderRadius: 22, padding: 18, gap: 12 },
  placeCreateHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: '#171D22' },
  placeHelp: { color: '#665D82', lineHeight: 19 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#161C21' },
  primaryButton: { backgroundColor: '#4B1F5B', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  buttonDisabled: { opacity: 0.5 },
  emptyPlaceCard: { backgroundColor: '#E9EDF0', borderRadius: 18, padding: 16 },
  emptyPlaceTitle: { color: '#303941', fontWeight: '900' },
  emptyPlaceText: { color: '#6C7780', marginTop: 4, lineHeight: 18 },
  placeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', padding: 14, borderRadius: 18 },
  placeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' },
  placeIconText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  placeName: { color: '#1C2329', fontWeight: '900' },
  placeMeta: { color: '#7A858E', fontSize: 13, marginTop: 2 },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', padding: 14, borderRadius: 18 },
  eventIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  eventEntered: { backgroundColor: '#E8F5EC' },
  eventExited: { backgroundColor: '#FFF0E0' },
  eventIconText: { fontSize: 20, fontWeight: '900', color: '#27323A' },
  eventTitle: { color: '#1C2329', fontWeight: '900' },
  eventMeta: { color: '#7A858E', fontSize: 12, marginTop: 3 },
  deleteLink: { color: '#C0392B', fontWeight: '800' },
  memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#101418', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  avatarPhoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E8EDF2' },
  selectedName: { fontSize: 19, fontWeight: '900', color: '#171D22' },
  selectedStatus: { color: '#68737D', marginTop: 3 },
  statRow: { flexDirection: 'row', gap: 8 },
  historyRow: { flexDirection: 'row', gap: 8 },
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
  avatarSmallPhoto: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8EDF2' },
  memberName: { color: '#1C2329', fontWeight: '800', fontSize: 15 },
  memberMeta: { color: '#7A858E', fontSize: 13, marginTop: 3 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C8CFD4' },
  onlineDotActive: { backgroundColor: '#20A760' },
  privacyNote: { color: '#7A858E', fontSize: 12, lineHeight: 18, paddingHorizontal: 4, marginTop: 4 },
  flex: { flex: 1 },
})
