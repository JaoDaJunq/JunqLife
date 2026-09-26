import { useEffect, useMemo, useState } from 'react'
import Constants from 'expo-constants'
import {
  ActivityIndicator,
  Image,
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
import { getAvatarPublicUrl, getMyProfile, updateMyProfile, uploadMyAvatar } from '@/src/lib/api'
import { supabase } from '@/src/lib/supabase'
import Brand from '@/src/components/Brand'

const RELEASES_API = 'https://api.github.com/repos/JaoDaJunq/JunqLife/releases?per_page=5'
const FALLBACK_DOWNLOAD = 'https://github.com/JaoDaJunq/JunqLife/releases/latest/download/JunqLife.apk'

type ReleaseInfo = {
  tag_name?: string
  name?: string
  body?: string
  draft?: boolean
  prerelease?: boolean
  published_at?: string
  html_url?: string
  assets?: Array<{
    name?: string
    size?: number
    browser_download_url?: string
  }>
}

function formatDate(value?: string) {
  if (!value) return 'publicação pendente'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'data indisponível'
  return date.toLocaleDateString('pt-BR')
}

function formatBytes(value?: number) {
  if (!value || value <= 0) return null
  const mb = value / 1024 / 1024
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}

function cleanReleaseBody(value?: string) {
  if (!value) return 'Melhorias e correções desta versão.'
  const cleaned = value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim()
  return cleaned || 'Melhorias e correções desta versão.'
}

export default function WebPortal() {
  const { user } = useAuth()
  const [profileName, setProfileName] = useState('')
  const [profileAvatarPath, setProfileAvatarPath] = useState<string | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [releases, setReleases] = useState<ReleaseInfo[]>([])
  const [releaseLoading, setReleaseLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    let active = true
    getMyProfile(user.id)
      .then((profile) => {
        if (active) {
          setProfileName(profile.display_name)
          setProfileAvatarPath(profile.avatar_path)
        }
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

    fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('release_unavailable')
        return (await response.json()) as ReleaseInfo[]
      })
      .then((nextReleases) => {
        if (!active) return
        setReleases(
          nextReleases
            .filter((item) => !item.draft && !item.prerelease)
            .slice(0, 5),
        )
      })
      .catch(() => {
        if (active) setReleases([])
      })
      .finally(() => {
        if (active) setReleaseLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const confirmed = Boolean(user?.email_confirmed_at)
  const release = releases[0] ?? null

  const downloadAsset = useMemo(
    () => release?.assets?.find((item) => item.name === 'JunqLife.apk') ?? null,
    [release],
  )

  const downloadUrl = downloadAsset?.browser_download_url || FALLBACK_DOWNLOAD
  const releaseVersion =
    release?.tag_name || `v${Constants.expoConfig?.version ?? '0.1.16'}`
  const releaseSize = formatBytes(downloadAsset?.size)

  const avatarUrl = getAvatarPublicUrl(profileAvatarPath)
  const profileInitials = profileName.trim().slice(0, 2).toUpperCase() || '?'

  const chooseAvatar = async () => {
    if (!user || avatarBusy || typeof document === 'undefined') return

    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/jpeg,image/png,image/webp'
      input.onchange = () => resolve(input.files?.[0] ?? null)
      input.oncancel = () => resolve(null)
      input.click()
    })

    if (!file) return

    setAvatarBusy(true)
    try {
      const profile = await uploadMyAvatar(user.id, file)
      setProfileAvatarPath(profile.avatar_path)
      alert('Foto de perfil atualizada.')
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : 'Tente novamente.'
      alert(message || 'Não foi possível atualizar a foto.')
    } finally {
      setAvatarBusy(false)
    }
  }

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
              <Brand size={34} tagline />
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

              <View style={styles.avatarRow}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
                ) : (
                  <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                    <Text style={styles.profileAvatarText}>{profileInitials}</Text>
                  </View>
                )}
                <View style={styles.avatarCopy}>
                  <Text style={styles.avatarTitle}>Sua foto</Text>
                  <Text style={styles.avatarHelp}>JPG, PNG ou WebP · até 5 MB</Text>
                  <Pressable
                    onPress={() => void chooseAvatar()}
                    disabled={avatarBusy || profileLoading}
                  >
                    <Text style={styles.link}>
                      {avatarBusy ? 'Enviando...' : avatarUrl ? 'Trocar foto' : 'Adicionar foto'}
                    </Text>
                  </Pressable>
                </View>
              </View>

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
                    : `Publicada em ${formatDate(release?.published_at)}${releaseSize ? ` · ${releaseSize}` : ''}`}
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

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>HISTÓRICO DE VERSÕES</Text>
            <Text style={styles.cardTitle}>Atualizações recentes</Text>
            {releaseLoading ? (
              <ActivityIndicator />
            ) : releases.length === 0 ? (
              <Text style={styles.cardText}>Não foi possível consultar o histórico agora. O download direto continua disponível.</Text>
            ) : (
              <View style={styles.releaseList}>
                {releases.map((item, index) => (
                  <View key={item.tag_name ?? String(index)} style={styles.releaseItem}>
                    <View style={styles.releaseHeader}>
                      <Text style={styles.releaseTag}>{item.tag_name ?? item.name ?? 'Versão'}</Text>
                      <Text style={styles.releaseDate}>{formatDate(item.published_at)}</Text>
                    </View>
                    <Text style={styles.releaseBody} numberOfLines={index === 0 ? 8 : 3}>
                      {cleanReleaseBody(item.body)}
                    </Text>
                    {item.html_url && (
                      <Pressable onPress={() => void Linking.openURL(item.html_url!)}>
                        <Text style={styles.link}>Ver release no GitHub</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>INSTALAÇÃO</Text>
              <Text style={styles.cardTitle}>Como atualizar</Text>
              <Text style={styles.change}>1. Baixe o APK mais recente nesta página.</Text>
              <Text style={styles.change}>2. Abra o arquivo baixado no Android.</Text>
              <Text style={styles.change}>3. Se o sistema pedir, autorize a instalação desta fonte.</Text>
              <Text style={styles.change}>4. Instale por cima da versão atual. Sua conta e seus dados continuam intactos.</Text>
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
  safe: { flex: 1, backgroundColor: '#FAF7EF' },
  outer: { flexGrow: 1, padding: 20 },
  shell: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 18 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 34, fontWeight: '900', color: '#4B1F5B', letterSpacing: -1.2 },
  kicker: { color: '#7A3B8F', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  link: { color: '#7A3B8F', fontWeight: '800' },
  hero: {
    backgroundColor: '#4B1F5B',
    borderRadius: 28,
    padding: 28,
    gap: 18,
  },
  heroCopy: { gap: 7 },
  heroEyebrow: { color: '#D4AF37', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
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
  downloadCard: { backgroundColor: '#F4EFF6' },
  cardEyebrow: { color: '#77838D', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  cardTitle: { color: '#151A1F', fontSize: 22, fontWeight: '900' },
  cardText: { color: '#66727C', lineHeight: 21 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatar: { width: 72, height: 72, borderRadius: 36 },
  profileAvatarFallback: { backgroundColor: '#E8EDF2', alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#34404A', fontWeight: '900', fontSize: 18 },
  avatarCopy: { flex: 1, gap: 3 },
  avatarTitle: { color: '#273139', fontWeight: '900' },
  avatarHelp: { color: '#89939B', fontSize: 12 },
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
    color: '#24172B',
  },
  secondaryButton: { backgroundColor: '#E8ECEF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#4B1F5B', fontWeight: '900' },
  versionBlock: { gap: 2, marginVertical: 4 },
  versionLabel: { color: '#70809A', fontSize: 11, fontWeight: '800' },
  version: { color: '#4B1F5B', fontSize: 34, fontWeight: '900' },
  versionDate: { color: '#6B7890', fontSize: 12 },
  downloadButton: { backgroundColor: '#D4AF37', borderRadius: 15, paddingVertical: 16, alignItems: 'center' },
  downloadButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  disabled: { opacity: 0.45 },
  smallText: { color: '#6F7C89', fontSize: 12, lineHeight: 18 },
  steps: { gap: 14 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4B1F5B',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 30,
    fontWeight: '900',
  },
  stepTitle: { color: '#20272D', fontWeight: '900' },
  stepText: { color: '#6F7A83', marginTop: 2, lineHeight: 19 },
  change: { color: '#54616B', lineHeight: 20 },
  releaseList: { gap: 12 },
  releaseItem: { backgroundColor: '#F5F7F9', borderRadius: 16, padding: 15, gap: 7 },
  releaseHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  releaseTag: { color: '#1F2A33', fontWeight: '900', fontSize: 16 },
  releaseDate: { color: '#89939B', fontSize: 12, fontWeight: '700' },
  releaseBody: { color: '#5F6B75', lineHeight: 19, fontSize: 13 },
  comingSoon: { alignSelf: 'flex-start', backgroundColor: '#EEE9FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  comingSoonText: { color: '#6345B8', fontSize: 12, fontWeight: '900' },
  footer: { textAlign: 'center', color: '#8B959D', fontSize: 11, marginVertical: 14 },
  flex: { flex: 1 },
})
