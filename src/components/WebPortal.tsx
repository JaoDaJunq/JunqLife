import { useEffect, useMemo, useState } from 'react'
import Constants from 'expo-constants'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/src/context/AuthProvider'
import { getMyProfile, updateMyProfile } from '@/src/lib/api'
import { supabase } from '@/src/lib/supabase'

const RELEASE_API = 'https://api.github.com/repos/JaoDaJunq/JunqLife/releases/latest'
const FALLBACK_DOWNLOAD = 'https://github.com/JaoDaJunq/JunqLife/releases/latest/download/JunqLife.apk'

type ReleaseInfo = {
  tag_name?: string
  published_at?: string
  html_url?: string
  assets?: Array<{
    name?: string
    browser_download_url?: string
  }>
}

function formatDate(value?: string) {
  if (!value) return 'publicação pendente'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'data indisponível'
  return date.toLocaleDateString('pt-BR')
}

export default function WebPortal() {
  const { user } = useAuth()
  const [profileName, setProfileName] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [release, setRelease] = useState<ReleaseInfo | null>(null)
  const [releaseLoading, setReleaseLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    let active = true
    getMyProfile(user.id)
      .then((profile) => {
        if (active) setProfileName(profile.display_name)
      })
      .catch(() => {
        if (active) {
          setProfileName(
            String(user.user_metadata?.display_name || user.email?.split('@')[0] || ''),
          )
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    let active = true

    fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('release_unavailable')
        return (await response.json()) as ReleaseInfo
      })
      .then((nextRelease) => {
        if (active) setRelease(nextRelease)
      })
      .catch(() => {
        if (active) setRelease(null)
      })
      .finally(() => {
        if (active) setReleaseLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const confirmed = Boolean(user?.email_confirmed_at)

  const downloadUrl = useMemo(() => {
    const asset = release?.assets?.find((item) => item.name === 'JunqLife.apk')
    return asset?.browser_download_url || FALLBACK_DOWNLOAD
  }, [release])

  const releaseVersion =
    release?.tag_name || `v${Constants.expoConfig?.version ?? '0.1.12'}`

  const saveProfile = async () => {
    if (!user || profileBusy) return
    setProfileBusy(true)
    try {
      const profile = await updateMyProfile(user.id, profileName)
      setProfileName(profile.display_name)
      await supabase.auth.updateUser({
        data: { display_name: profile.display_name },
      })
      alert('Perfil atualizado.')
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : 'Tente novamente.'
      alert(message || 'Tente novamente.')
    } finally {
      setProfileBusy(false)
    }
  }

  if (!user) return null

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.outer}>
        <View style={styles.shell}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.brand}>JunqLife</Text>
              <Text style={styles.kicker}>CENTRAL DO APP</Text>
            </View>
            <Pressable onPress={() => void supabase.auth.signOut()}>
              <Text style={styles.link}>Sair</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>CONTA PRONTA</Text>
              <Text style={styles.heroTitle}>Seu acesso ao JunqLife começa aqui.</Text>
              <Text style={styles.heroText}>
                Gerencie sua conta, acompanhe a versão atual e baixe o aplicativo Android oficial.
              </Text>
            </View>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, confirmed && styles.statusDotOk]} />
              <Text style={styles.statusPillText}>
                {confirmed ? 'E-mail confirmado' : 'Confirmação pendente'}
              </Text>
            </View>
          </View>

          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>SUA CONTA</Text>
              <Text style={styles.cardTitle}>Perfil</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>E-mail</Text>
                <Text style={styles.infoValue}>{user.email ?? '—'}</Text>
              </View>

              <Text style={styles.fieldLabel}>Como você aparece no JunqLife</Text>
              {profileLoading ? (
                <ActivityIndicator />
              ) : (
                <TextInput
                  value={profileName}
                  onChangeText={setProfileName}
                  placeholder="Seu nome"
                  style={styles.input}
                  maxLength={80}
                />
              )}

              <Pressable
                onPress={() => void saveProfile()}
                disabled={profileBusy || profileLoading}
                style={[styles.secondaryButton, (profileBusy || profileLoading) && styles.disabled]}
              >
                <Text style={styles.secondaryButtonText}>
                  {profileBusy ? 'Salvando...' : 'Salvar perfil'}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.card, styles.downloadCard]}>
              <Text style={styles.cardEyebrow}>ANDROID</Text>
              <Text style={styles.cardTitle}>Baixar JunqLife</Text>

              <View style={styles.versionBlock}>
                <Text style={styles.versionLabel}>Versão disponível</Text>
                <Text style={styles.version}>
                  {releaseLoading ? 'Consultando...' : releaseVersion}
                </Text>
                <Text style={styles.versionDate}>
                  {releaseLoading
                    ? 'Buscando a última build oficial'
                    : `Publicada em ${formatDate(release?.published_at)}`}
                </Text>
              </View>

              <Pressable
                onPress={() => void Linking.openURL(downloadUrl)}
                disabled={!confirmed}
                style={[styles.downloadButton, !confirmed && styles.disabled]}
              >
                <Text style={styles.downloadButtonText}>
                  {confirmed ? 'Baixar APK' : 'Confirme o e-mail para baixar'}
                </Text>
              </Pressable>

              <Text style={styles.smallText}>
                Pode instalar por cima de uma versão anterior. Seus dados continuam na sua conta.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>COMO FUNCIONA</Text>
            <Text style={styles.cardTitle}>Da Central para o aplicativo</Text>
            <View style={styles.steps}>
              <View style={styles.step}>
                <Text style={styles.stepNumber}>1</Text>
                <View style={styles.flex}>
                  <Text style={styles.stepTitle}>Crie e confirme a conta</Text>
                  <Text style={styles.stepText}>Todo o cadastro fica nesta Central.</Text>
                </View>
              </View>
              <View style={styles.step}>
                <Text style={styles.stepNumber}>2</Text>
                <View style={styles.flex}>
                  <Text style={styles.stepTitle}>Baixe o APK atual</Text>
                  <Text style={styles.stepText}>O arquivo vem da release oficial do projeto.</Text>
                </View>
              </View>
              <View style={styles.step}>
                <Text style={styles.stepNumber}>3</Text>
                <View style={styles.flex}>
                  <Text style={styles.stepTitle}>Instale e faça login</Text>
                  <Text style={styles.stepText}>Use no app o mesmo e-mail e senha cadastrados aqui.</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>ATUALIZAÇÕES</Text>
              <Text style={styles.cardTitle}>O que entrou agora</Text>
              <Text style={styles.change}>• Central web para conta e download</Text>
              <Text style={styles.change}>• APK simplificado para login</Text>
              <Text style={styles.change}>• Releases Android automáticas</Text>
              <Text style={styles.change}>• Gestão de membros e admins do círculo</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>IPHONE</Text>
              <Text style={styles.cardTitle}>iOS vem depois</Text>
              <Text style={styles.cardText}>
                A estrutura já está preparada, mas a build iOS e o TestFlight ainda não foram validados em um iPhone real.
              </Text>
              <View style={styles.comingSoon}>
                <Text style={styles.comingSoonText}>TestFlight em breve</Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>
            JunqLife · localização compartilhada somente com consentimento.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  outer: { flexGrow: 1, padding: 20 },
  shell: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 18 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 34, fontWeight: '900', color: '#101418', letterSpacing: -1.2 },
  kicker: { color: '#78838C', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  link: { color: '#356AE6', fontWeight: '800' },
  hero: {
    backgroundColor: '#101418',
    borderRadius: 28,
    padding: 28,
    gap: 18,
  },
  heroCopy: { gap: 7 },
  heroEyebrow: { color: '#8CA9FF', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  heroTitle: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', maxWidth: 620 },
  heroText: { color: '#C5CDD5', fontSize: 16, lineHeight: 23, maxWidth: 680 },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#222A30',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#F0A33B' },
  statusDotOk: { backgroundColor: '#24B36B' },
  statusPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  card: {
    flexGrow: 1,
    flexBasis: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    gap: 12,
  },
  downloadCard: { backgroundColor: '#EEF3FF' },
  cardEyebrow: { color: '#77838D', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  cardTitle: { color: '#151A1F', fontSize: 22, fontWeight: '900' },
  cardText: { color: '#66727C', lineHeight: 21 },
  infoRow: { gap: 4 },
  infoLabel: { color: '#89939B', fontSize: 11, fontWeight: '800' },
  infoValue: { color: '#263039', fontWeight: '800' },
  fieldLabel: { color: '#5C6872', fontSize: 12, fontWeight: '800', marginTop: 4 },
  input: {
    backgroundColor: '#F2F4F6',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    color: '#101418',
  },
  secondaryButton: { backgroundColor: '#E8ECEF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#101418', fontWeight: '900' },
  versionBlock: { gap: 2, marginVertical: 4 },
  versionLabel: { color: '#70809A', fontSize: 11, fontWeight: '800' },
  version: { color: '#173E91', fontSize: 34, fontWeight: '900' },
  versionDate: { color: '#6B7890', fontSize: 12 },
  downloadButton: { backgroundColor: '#356AE6', borderRadius: 15, paddingVertical: 16, alignItems: 'center' },
  downloadButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.45 },
  smallText: { color: '#6F7C89', fontSize: 12, lineHeight: 18 },
  steps: { gap: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#101418',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
    fontWeight: '900',
  },
  stepTitle: { color: '#20272D', fontWeight: '900' },
  stepText: { color: '#6F7A83', marginTop: 2, lineHeight: 19 },
  change: { color: '#54616B', lineHeight: 20 },
  comingSoon: { alignSelf: 'flex-start', backgroundColor: '#EEE9FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  comingSoonText: { color: '#6345B8', fontSize: 12, fontWeight: '900' },
  footer: { textAlign: 'center', color: '#8B959D', fontSize: 11, marginVertical: 14 },
  flex: { flex: 1 },
})
