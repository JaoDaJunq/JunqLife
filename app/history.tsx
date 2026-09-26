import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '@/src/context/AuthProvider'
import { listCircles, type Circle } from '@/src/lib/api'
import { loadTodayHistory, type HistorySummary } from '@/src/lib/history'
import Brand from '@/src/components/Brand'

function time(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [circles, setCircles] = useState<Circle[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [summary, setSummary] = useState<HistorySummary | null>(null)
  const [loading, setLoading] = useState(true)

  const selectedCircle = useMemo(() => circles.find((circle) => circle.id === selectedId), [circles, selectedId])

  useEffect(() => {
    if (!user) return
    listCircles().then((next) => {
      setCircles(next)
      setSelectedId(next[0]?.id ?? null)
    }).catch(() => setCircles([])).finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!selectedId || !user) return
    setSummary(null)
    loadTodayHistory(selectedId, user.id).catch(() => null).then((next) => setSummary(next))
  }, [selectedId, user])

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}><Text style={styles.backText}>‹</Text></Pressable>
          <Brand size={30} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>PRESENÇA EM MOVIMENTO</Text>
          <Text style={styles.title}>Seu histórico</Text>
          <Text style={styles.heroText}>Veja os pontos registrados hoje e escolha em qual círculo sua atividade pode aparecer.</Text>
        </View>

        <Text style={styles.sectionTitle}>Círculo do histórico</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circleTabs}>
          {circles.map((circle) => (
            <Pressable key={circle.id} onPress={() => setSelectedId(circle.id)} style={[styles.circleTab, circle.id === selectedId && styles.circleTabActive]}>
              <Text style={[styles.circleTabText, circle.id === selectedId && styles.circleTabTextActive]}>{circle.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading || !selectedCircle ? <ActivityIndicator color="#7A3B8F" /> : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View style={styles.flex}><Text style={styles.summaryLabel}>HOJE · {selectedCircle.name}</Text><Text style={styles.summaryTitle}>Resumo do dia</Text></View>
                <View style={styles.liveDot} />
              </View>
              <View style={styles.stats}>
                <View style={styles.stat}><Text style={styles.statValue}>{summary?.points.length ?? 0}</Text><Text style={styles.statLabel}>pontos</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{summary?.distanceKm.toFixed(1) ?? '0.0'}</Text><Text style={styles.statLabel}>km estimados</Text></View>
                <View style={styles.stat}><Text style={styles.statValue}>{time(summary?.endedAt ?? null)}</Text><Text style={styles.statLabel}>último registro</Text></View>
              </View>
            </View>

            <View style={styles.privacyCard}>
              <View style={styles.privacyIcon}><Text style={styles.privacyIconText}>◉</Text></View>
              <View style={styles.flex}><Text style={styles.cardTitle}>Visibilidade do histórico</Text><Text style={styles.cardText}>O círculo só acessa seus registros quando o compartilhamento de localização estiver ativo.</Text></View>
              <Text style={styles.privacyStatus}>Protegido</Text>
            </View>

            <Text style={styles.sectionTitle}>Linha do tempo</Text>
            {(summary?.points ?? []).slice().reverse().slice(0, 12).map((point, index) => (
              <View key={point.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}><View style={styles.timelineDot} />{index < Math.min((summary?.points.length ?? 0) - 1, 11) && <View style={styles.timelineLine} />}</View>
                <View style={styles.flex}><Text style={styles.timelineTime}>{time(point.recorded_at)}</Text><Text style={styles.timelineMeta}>{point.accuracy_m ? `Precisão de ${Math.round(point.accuracy_m)} m` : 'Localização registrada'}{point.battery_level != null ? ` · Bateria ${Math.round(point.battery_level * 100)}%` : ''}</Text></View>
              </View>
            ))}
            {!summary?.points.length && <Text style={styles.empty}>Nenhum ponto registrado hoje. Ative o compartilhamento para começar.</Text>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAF7EF' },
  page: { padding: 18, paddingBottom: 48, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#4B1F5B', fontSize: 30, lineHeight: 32, marginTop: -2 },
  hero: { backgroundColor: '#4B1F5B', borderRadius: 26, padding: 22, gap: 7 },
  eyebrow: { color: '#D4AF37', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  heroText: { color: '#E9DFF0', lineHeight: 20 },
  sectionTitle: { color: '#24172B', fontSize: 20, fontWeight: '900', marginTop: 2 },
  circleTabs: { gap: 8 },
  circleTab: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderColor: '#EEE3F0' },
  circleTabActive: { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  circleTabText: { color: '#7A3B8F', fontWeight: '800' },
  circleTabTextActive: { color: '#24172B' },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 19, gap: 18, borderWidth: 1, borderColor: '#F0E6F3' },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryLabel: { color: '#7A3B8F', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  summaryTitle: { color: '#24172B', fontSize: 22, fontWeight: '900', marginTop: 4 },
  liveDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2F9B68' },
  stats: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, backgroundColor: '#F4EFF6', borderRadius: 15, padding: 12 },
  statValue: { color: '#4B1F5B', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#756A7D', fontSize: 11, marginTop: 3 },
  privacyCard: { backgroundColor: '#F7EFD0', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  privacyIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' },
  privacyIconText: { color: '#4B1F5B', fontWeight: '900' },
  cardTitle: { color: '#24172B', fontWeight: '900' },
  cardText: { color: '#756A7D', lineHeight: 18, fontSize: 12, marginTop: 3 },
  privacyStatus: { color: '#6C5310', fontSize: 11, fontWeight: '900' },
  timelineRow: { flexDirection: 'row', gap: 12, minHeight: 52 },
  timelineRail: { width: 14, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D4AF37', borderWidth: 3, borderColor: '#F7EFD0' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E7D9EC', marginTop: 3 },
  timelineTime: { color: '#4B1F5B', fontWeight: '900' },
  timelineMeta: { color: '#756A7D', fontSize: 12, marginTop: 3 },
  empty: { color: '#756A7D', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, lineHeight: 20 },
  flex: { flex: 1 },
})
