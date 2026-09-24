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
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/src/context/AuthProvider'
import {
  clearTrackingLogs,
  getStoredDeviceId,
  prepareTracking,
  sendPositionNow,
  trackingIsActive,
  trackingLogs,
  TRACKING_SUPPORTED,
} from '@/src/lib/tracking'
import {
  loadTrackingServerDiagnostics,
  type TrackingServerDiagnostics,
} from '@/src/lib/diagnostics'

type SafeLog = {
  time: number
  message: string
}

function when(value: string | null | undefined) {
  if (!value) return 'Nunca'
  return new Date(value).toLocaleString()
}

function percent(value: number | null | undefined) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function sanitizeLogMessage(message: string) {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}\.[0-9a-f]{64}/gi, '[credencial-do-aparelho]')
    .replace(/([?&](?:lat|lon|latitude|longitude)=)[^&\s]+/gi, '$1[oculto]')
}

export default function DiagnosticsScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [active, setActive] = useState(false)
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null)
  const [server, setServer] = useState<TrackingServerDiagnostics | null>(null)
  const [logs, setLogs] = useState<SafeLog[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return

    setError(null)
    try {
      const [isActive, storedId, serverState, nativeLogs] = await Promise.all([
        trackingIsActive().catch(() => false),
        getStoredDeviceId().catch(() => null),
        loadTrackingServerDiagnostics(user.id),
        trackingLogs().catch(() => []),
      ])

      setActive(isActive)
      setLocalDeviceId(storedId)
      setServer(serverState)
      setLogs(
        (nativeLogs as Array<{ time?: number; message?: string }>)
          .filter((entry) => typeof entry.message === 'string')
          .slice(-30)
          .reverse()
          .map((entry) => ({
            time: typeof entry.time === 'number' ? entry.time : Date.now(),
            message: sanitizeLogMessage(entry.message ?? ''),
          })),
      )
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Falha ao carregar diagnóstico.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const currentDevice = useMemo(
    () => server?.devices.find((device) => device.id === localDeviceId) ?? server?.devices[0] ?? null,
    [localDeviceId, server],
  )

  const prepare = async () => {
    setActionBusy(true)
    try {
      await prepareTracking()
      await refresh()
      Alert.alert('Aparelho preparado', 'Registro e configuração do tracker concluídos.')
    } catch (prepareError) {
      Alert.alert(
        'Falha ao preparar',
        prepareError instanceof Error ? prepareError.message : 'Confira internet e sessão.',
      )
    } finally {
      setActionBusy(false)
    }
  }

  const sendTest = async () => {
    setActionBusy(true)
    try {
      const sent = await sendPositionNow()
      await refresh()
      Alert.alert(
        sent ? 'Teste enviado' : 'Teste não enviado',
        sent
          ? 'O SDK confirmou o envio. Atualize esta tela em alguns segundos para conferir o banco.'
          : 'O SDK não confirmou o envio. Confira os logs abaixo.',
      )
    } catch (sendError) {
      await refresh()
      Alert.alert(
        'Erro no teste',
        sendError instanceof Error ? sendError.message : 'Confira permissões, GPS e internet.',
      )
    } finally {
      setActionBusy(false)
    }
  }

  const clearLogsNow = async () => {
    try {
      await clearTrackingLogs()
      await refresh()
    } catch (clearError) {
      Alert.alert('Não foi possível limpar', clearError instanceof Error ? clearError.message : 'Tente novamente.')
    }
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <Text style={styles.title}>Faça login para abrir o diagnóstico.</Text>
        <Pressable onPress={() => router.back()}><Text style={styles.link}>Voltar</Text></Pressable>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>DIAGNÓSTICO</Text>
            <Text style={styles.title}>GPS e sincronização</Text>
          </View>
          <Pressable onPress={refresh}><Text style={styles.link}>Atualizar</Text></Pressable>
        </View>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator size="large" /></View>
        ) : (
          <>
            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Erro ao carregar</Text>
                <Text style={styles.muted}>{error}</Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estado geral</Text>
              <Row label="Tracker nativo" value={TRACKING_SUPPORTED ? 'Disponível' : 'Web / indisponível'} ok={TRACKING_SUPPORTED} />
              <Row label="Rastreamento" value={active ? 'Ativo' : 'Parado'} ok={active} />
              <Row label="Credencial local" value={localDeviceId ? 'Registrada' : 'Ainda não criada'} ok={Boolean(localDeviceId)} />
              <Row
                label="Compartilhamento"
                value={server ? `${server.sharingEnabledCount}/${server.sharingTotalCount} círculo(s) ligado(s)` : '—'}
                ok={Boolean(server?.sharingEnabledCount)}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Supabase</Text>
              <Row label="Aparelhos registrados" value={String(server?.devices.length ?? 0)} ok={Boolean(server?.devices.length)} />
              <Row label="Aparelho local no servidor" value={currentDevice ? 'Encontrado' : 'Não encontrado'} ok={Boolean(currentDevice)} />
              <Row label="Último contato" value={when(currentDevice?.last_seen_at)} ok={Boolean(currentDevice?.last_seen_at)} />
              <Row label="Bateria do aparelho" value={percent(currentDevice?.battery_level)} />
              <Row
                label="Última posição recebida"
                value={when(server?.currentLocation?.recorded_at)}
                ok={Boolean(server?.currentLocation)}
              />
              <Row
                label="Precisão"
                value={server?.currentLocation?.accuracy_m == null ? '—' : `±${Math.round(server.currentLocation.accuracy_m)} m`}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Ações de teste</Text>
              <Action title={actionBusy ? 'Processando...' : 'Preparar / registrar aparelho'} onPress={prepare} disabled={!TRACKING_SUPPORTED || actionBusy} />
              <Action title="Enviar posição de teste" onPress={sendTest} disabled={!TRACKING_SUPPORTED || actionBusy} secondary />
              <Action title="Atualizar diagnóstico" onPress={refresh} secondary />
            </View>

            <View style={styles.card}>
              <View style={styles.logsHeader}>
                <Text style={styles.cardTitle}>Logs do tracker</Text>
                <Pressable onPress={clearLogsNow}><Text style={styles.link}>Limpar</Text></Pressable>
              </View>

              {logs.length === 0 ? (
                <Text style={styles.muted}>Nenhum log registrado ainda.</Text>
              ) : (
                logs.map((entry, index) => (
                  <View key={`${entry.time}-${index}`} style={styles.logItem}>
                    <Text style={styles.logTime}>{new Date(entry.time).toLocaleTimeString()}</Text>
                    <Text style={styles.logText}>{entry.message}</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.note}>
              O diagnóstico oculta credenciais e coordenadas dos logs exibidos. Ele não altera as permissões de compartilhamento dos seus círculos.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, ok && styles.dotOk]} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function Action({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string
  onPress: () => void
  secondary?: boolean
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  page: { padding: 18, paddingBottom: 50, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 30, lineHeight: 32, color: '#161C21' },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, color: '#77818A' },
  title: { fontSize: 24, fontWeight: '900', color: '#11161A', marginTop: 2 },
  link: { color: '#356AE6', fontWeight: '800' },
  flex: { flex: 1 },
  loading: { paddingVertical: 80, alignItems: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, gap: 12 },
  errorCard: { backgroundColor: '#FFEDEA', borderRadius: 20, padding: 18, gap: 5 },
  errorTitle: { color: '#9F2D21', fontWeight: '900' },
  cardTitle: { color: '#151A1F', fontSize: 18, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#C4CBD0' },
  dotOk: { backgroundColor: '#1BA45B' },
  rowLabel: { flex: 1, color: '#56616B', fontWeight: '700' },
  rowValue: { maxWidth: '48%', color: '#1E252B', fontWeight: '800', textAlign: 'right' },
  button: { backgroundColor: '#101418', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#E8ECEF' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  buttonSecondaryText: { color: '#101418' },
  logsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logItem: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E1E5E8' },
  logTime: { color: '#8A949C', fontSize: 11, fontWeight: '800' },
  logText: { color: '#3F4A53', marginTop: 3, lineHeight: 18, fontSize: 13 },
  muted: { color: '#707B84', lineHeight: 19 },
  note: { color: '#7B858E', fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
})
