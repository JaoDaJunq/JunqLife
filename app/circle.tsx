import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/src/context/AuthProvider'
import {
  listCircleMembers,
  listCircles,
  removeCircleMember,
  type Circle,
  type CircleMemberDetails,
} from '@/src/lib/api'

function errorMessage(error: unknown, fallback = 'Tente novamente.') {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim()
    if (message) return message
  }
  return fallback
}

function roleLabel(role: CircleMemberDetails['role']) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  return 'Membro'
}

export default function CircleManagementScreen() {
  const params = useLocalSearchParams<{ circleId?: string | string[] }>()
  const circleId = Array.isArray(params.circleId) ? params.circleId[0] : params.circleId
  const { user } = useAuth()

  const [circle, setCircle] = useState<Circle | null>(null)
  const [members, setMembers] = useState<CircleMemberDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!circleId) return
    setLoading(true)
    try {
      const [circles, nextMembers] = await Promise.all([
        listCircles(),
        listCircleMembers(circleId),
      ])
      setCircle(circles.find((item) => item.id === circleId) ?? null)
      setMembers(nextMembers)
    } catch (error) {
      Alert.alert('Não foi possível carregar', errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [circleId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const currentMember = useMemo(
    () => members.find((member) => member.userId === user?.id) ?? null,
    [members, user?.id],
  )

  const isOwner = circle?.owner_id === user?.id

  const removeMember = (member: CircleMemberDetails) => {
    if (!circleId || member.role === 'owner' || busyUserId) return

    Alert.alert(
      'Remover do círculo?',
      `${member.displayName} perderá acesso a este círculo e deixará de compartilhar localização nele.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setBusyUserId(member.userId)
            try {
              await removeCircleMember(circleId, member.userId)
              setMembers((current) => current.filter((item) => item.userId !== member.userId))
            } catch (error) {
              Alert.alert('Não foi possível remover', errorMessage(error))
            } finally {
              setBusyUserId(null)
            }
          },
        },
      ],
    )
  }

  const leaveCircle = () => {
    if (!circleId || !user || !currentMember || currentMember.role === 'owner' || busyUserId) return

    Alert.alert(
      'Sair do círculo?',
      'Você deixará de ver os membros e sua localização deixará de ser compartilhada neste círculo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            setBusyUserId(user.id)
            try {
              await removeCircleMember(circleId, user.id)
              router.replace('/')
            } catch (error) {
              Alert.alert('Não foi possível sair', errorMessage(error))
              setBusyUserId(null)
            }
          },
        },
      ],
    )
  }

  if (!circleId) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.title}>Círculo inválido.</Text>
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

  if (!circle || !user || !currentMember) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.title}>Você não faz mais parte deste círculo.</Text>
        <Pressable onPress={() => router.replace('/')}><Text style={styles.link}>Voltar para o início</Text></Pressable>
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
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>CÍRCULO</Text>
            <Text style={styles.heading}>{circle.name}</Text>
          </View>
          <Pressable onPress={() => void refresh()}>
            <Text style={styles.link}>Atualizar</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{members.length} {members.length === 1 ? 'membro' : 'membros'}</Text>
          <Text style={styles.summaryText}>
            {isOwner
              ? 'Como owner, você pode remover membros. Transferência de propriedade entra na próxima etapa.'
              : `Seu papel neste círculo: ${roleLabel(currentMember.role)}.`}
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Membros</Text>
        </View>

        {members.map((member) => {
          const isSelf = member.userId === user.id
          const canRemove = isOwner && !isSelf && member.role !== 'owner'
          const initials = member.displayName.trim().slice(0, 2).toUpperCase() || '?'

          return (
            <View key={member.userId} style={styles.memberCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.flex}>
                <Text style={styles.memberName}>
                  {member.displayName}{isSelf ? ' · Você' : ''}
                </Text>
                <View style={styles.roleRow}>
                  <View style={[
                    styles.roleBadge,
                    member.role === 'owner' && styles.roleOwner,
                    member.role === 'admin' && styles.roleAdmin,
                  ]}>
                    <Text style={styles.roleText}>{roleLabel(member.role)}</Text>
                  </View>
                  <Text style={styles.joinedText}>
                    Entrou em {new Date(member.joinedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {canRemove && (
                <Pressable
                  onPress={() => removeMember(member)}
                  disabled={Boolean(busyUserId)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeText}>
                    {busyUserId === member.userId ? '...' : 'Remover'}
                  </Text>
                </Pressable>
              )}
            </View>
          )
        })}

        {currentMember.role === 'owner' ? (
          <View style={styles.ownerNote}>
            <Text style={styles.ownerNoteTitle}>Você é o owner</Text>
            <Text style={styles.ownerNoteText}>
              Para sair deste círculo será necessário primeiro transferir a propriedade. Isso evita deixar um círculo sem responsável.
            </Text>
          </View>
        ) : (
          <Pressable
            style={[styles.leaveButton, busyUserId === user.id && styles.disabled]}
            disabled={Boolean(busyUserId)}
            onPress={leaveCircle}
          >
            <Text style={styles.leaveText}>
              {busyUserId === user.id ? 'Saindo...' : 'Sair deste círculo'}
            </Text>
          </Pressable>
        )}

        <Text style={styles.privacyNote}>
          Remover ou sair de um círculo também encerra o compartilhamento de localização naquele círculo. Outros círculos não são afetados.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  page: { padding: 18, paddingBottom: 50, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 30, color: '#161C21', lineHeight: 32, marginTop: -2 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: '#77818A' },
  heading: { fontSize: 26, fontWeight: '900', color: '#11161A', marginTop: 2 },
  link: { color: '#356AE6', fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '900', color: '#1B2228', textAlign: 'center' },
  summaryCard: { backgroundColor: '#101418', borderRadius: 24, padding: 20, gap: 6 },
  summaryTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  summaryText: { color: '#C5CDD5', lineHeight: 20 },
  sectionHeader: { marginTop: 4 },
  sectionTitle: { color: '#171D22', fontSize: 21, fontWeight: '900' },
  memberCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E8EDF2', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#34404A', fontWeight: '900', fontSize: 13 },
  memberName: { color: '#1C2329', fontWeight: '900', fontSize: 16 },
  roleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 6 },
  roleBadge: { backgroundColor: '#E9EDF0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  roleOwner: { backgroundColor: '#E8F0FF' },
  roleAdmin: { backgroundColor: '#F0ECFF' },
  roleText: { color: '#4A5660', fontSize: 11, fontWeight: '900' },
  joinedText: { color: '#8A949C', fontSize: 11 },
  removeButton: { paddingHorizontal: 10, paddingVertical: 8 },
  removeText: { color: '#C0392B', fontWeight: '800', fontSize: 12 },
  ownerNote: { backgroundColor: '#FFF5DF', borderRadius: 20, padding: 18, gap: 5 },
  ownerNoteTitle: { color: '#6E4E08', fontWeight: '900' },
  ownerNoteText: { color: '#80672E', lineHeight: 19 },
  leaveButton: { backgroundColor: '#FFE9E6', borderRadius: 16, alignItems: 'center', paddingVertical: 15 },
  leaveText: { color: '#B3362B', fontWeight: '900' },
  disabled: { opacity: 0.5 },
  privacyNote: { color: '#7A858E', fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
  flex: { flex: 1 },
})
