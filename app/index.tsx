import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/src/context/AuthProvider'
import {
  acceptInvite,
  createCircle,
  createInvite,
  getSharing,
  listCircles,
  setSharing,
  type Circle,
} from '@/src/lib/api'
import { supabase } from '@/src/lib/supabase'
import {
  TRACKING_SUPPORTED,
  sendPositionNow,
  startTracking,
  stopTracking,
  trackingIsActive,
} from '@/src/lib/tracking'

function Button({
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
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>
    </Pressable>
  )
}

const WEB_APP_URL = 'https://jaodajunq.github.io/JunqLife/'

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Se você acabou de criar a conta, confirme o e-mail primeiro.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Abra o e-mail do JunqLife ou toque em “Reenviar confirmação”.'
  }
  if (normalized.includes('redirect')) {
    return 'Não foi possível concluir o redirecionamento de autenticação. Tente novamente.'
  }

  return message || 'Tente novamente.'
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [resetting, setResetting] = useState(false)

  const submit = async () => {
    if (!email.trim() || password.length < 6 || (mode === 'signup' && !name.trim())) {
      Alert.alert('Confira os dados', 'Preencha os campos. A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: WEB_APP_URL,
          },
        })
        if (error) throw error
        if (!data.session) {
          Alert.alert('Conta criada', 'Confira seu e-mail para confirmar a conta antes de entrar.')
          setMode('login')
        }
      }
    } catch (error) {
      Alert.alert('Não foi possível continuar', authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const sendPasswordReset = async () => {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      Alert.alert('Informe seu e-mail', 'Digite o e-mail da conta para recuperar a senha.')
      return
    }

    setResetting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: WEB_APP_URL,
      })
      if (error) throw error

      Alert.alert(
        'E-mail de recuperação enviado',
        'Abra o e-mail do JunqLife e toque no link. O navegador vai abrir uma tela para definir a nova senha.',
      )
    } catch (error) {
      Alert.alert('Não foi possível enviar o reset', authErrorMessage(error))
    } finally {
      setResetting(false)
    }
  }

  const resendConfirmation = async () => {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      Alert.alert('Informe seu e-mail', 'Digite o e-mail da conta para reenviar a confirmação.')
      return
    }

    setResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: { emailRedirectTo: WEB_APP_URL },
      })
      if (error) throw error

      Alert.alert(
        'Confirmação reenviada',
        'Confira sua caixa de entrada e o spam. O link agora volta para o JunqLife.',
      )
    } catch (error) {
      Alert.alert('Não foi possível reenviar', authErrorMessage(error))
    } finally {
      setResending(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>JunqLife</Text>
          <Text style={styles.subtitle}>Seu círculo, no mapa, com consentimento.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>

          {mode === 'signup' && (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Como quer aparecer?"
              style={styles.input}
              autoCapitalize="words"
            />
          )}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Senha"
            secureTextEntry
            style={styles.input}
          />

          <Button title={busy ? 'Carregando...' : mode === 'login' ? 'Entrar' : 'Criar conta'} onPress={submit} disabled={busy} />

          <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.link}>
              {mode === 'login' ? 'Ainda não tem conta? Criar agora' : 'Já tem conta? Entrar'}
            </Text>
          </Pressable>

          {mode === 'login' && (
            <>
              <Pressable onPress={sendPasswordReset} disabled={resetting || busy}>
                <Text style={styles.linkMuted}>
                  {resetting ? 'Enviando recuperação...' : 'Esqueceu a senha? Redefinir'}
                </Text>
              </Pressable>

              <Pressable onPress={resendConfirmation} disabled={resending || busy}>
                <Text style={styles.linkMuted}>
                  {resending ? 'Reenviando confirmação...' : 'Não confirmou o e-mail? Reenviar confirmação'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}


function RecoveryScreen() {
  const { clearRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const updatePassword = async () => {
    if (password.length < 8) {
      Alert.alert('Senha muito curta', 'Use pelo menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Senhas diferentes', 'Digite a mesma senha nos dois campos.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      clearRecovery()
      await supabase.auth.signOut()
      Alert.alert('Senha redefinida', 'Agora entre no JunqLife usando a nova senha.')
    } catch (error) {
      Alert.alert('Não foi possível redefinir', authErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>JunqLife</Text>
          <Text style={styles.subtitle}>Defina uma nova senha para sua conta.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Redefinir senha</Text>
          <Text style={styles.recoveryHelp}>
            Você abriu um link de recuperação válido. Escolha uma senha nova e depois volte ao aplicativo.
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Nova senha"
            secureTextEntry
            style={styles.input}
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirmar nova senha"
            secureTextEntry
            style={styles.input}
          />

          <Button
            title={busy ? 'Salvando...' : 'Salvar nova senha'}
            onPress={updatePassword}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function HomeScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const [circles, setCircles] = useState<Circle[]>([])
  const [newCircle, setNewCircle] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [sharing, setSharingState] = useState<Record<string, boolean>>({})
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [trackingActive, setTrackingActive] = useState(false)
  const [trackingBusy, setTrackingBusy] = useState(false)

  const displayName = useMemo(
    () => String(user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Você'),
    [user],
  )

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const next = await listCircles()
      setCircles(next)
      const pairs = await Promise.all(
        next.map(async (circle) => [circle.id, await getSharing(circle.id, user.id)] as const),
      )
      setSharingState(Object.fromEntries(pairs))
    } catch (error) {
      Alert.alert('Erro ao carregar', error instanceof Error ? error.message : 'Tente novamente.')
    }
  }, [user])

  useEffect(() => {
    refresh()
    if (TRACKING_SUPPORTED) {
      trackingIsActive().then(setTrackingActive).catch(() => setTrackingActive(false))
    }
  }, [refresh])

  const handleCreate = async () => {
    if (!user || busy) return
    setBusy(true)
    try {
      await createCircle(newCircle, user.id)
      setNewCircle('')
      await refresh()
    } catch (error) {
      Alert.alert('Não foi possível criar', error instanceof Error ? error.message : 'Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (busy) return
    setBusy(true)
    try {
      await acceptInvite(inviteCode)
      setInviteCode('')
      await refresh()
      Alert.alert('Entrou!', 'Você agora faz parte do círculo.')
    } catch (error) {
      Alert.alert('Convite inválido', error instanceof Error ? error.message : 'Confira o código.')
    } finally {
      setBusy(false)
    }
  }

  const toggleSharing = async (circleId: string, value: boolean) => {
    if (!user) return
    const previous = sharing[circleId]
    const nextSharing = { ...sharing, [circleId]: value }
    setSharingState(nextSharing)

    try {
      await setSharing(circleId, user.id, value)

      if (!Object.values(nextSharing).some(Boolean) && trackingActive) {
        await stopTracking()
        setTrackingActive(false)
      }
    } catch (error) {
      setSharingState((current) => ({ ...current, [circleId]: previous }))
      Alert.alert('Não foi possível alterar', error instanceof Error ? error.message : 'Tente novamente.')
    }
  }

  const handleTracking = async () => {
    if (!TRACKING_SUPPORTED || trackingBusy) return

    if (!Object.values(sharing).some(Boolean) && !trackingActive) {
      Alert.alert('Compartilhamento desligado', 'Ative a localização em pelo menos um círculo antes de iniciar o rastreamento.')
      return
    }

    setTrackingBusy(true)
    try {
      if (trackingActive) {
        await stopTracking()
        setTrackingActive(false)
      } else {
        await startTracking()
        setTrackingActive(true)
      }
    } catch (error) {
      Alert.alert(
        'Não foi possível alterar o rastreamento',
        error instanceof Error ? error.message : 'Confira as permissões de localização do aparelho.',
      )
    } finally {
      setTrackingBusy(false)
    }
  }

  const handlePositionNow = async () => {
    if (!TRACKING_SUPPORTED || trackingBusy) return
    if (!Object.values(sharing).some(Boolean)) {
      Alert.alert('Compartilhamento desligado', 'Ative a localização em pelo menos um círculo primeiro.')
      return
    }

    setTrackingBusy(true)
    try {
      const sent = await sendPositionNow()
      Alert.alert(sent ? 'Posição enviada' : 'Não foi possível enviar', sent ? 'O ponto atual foi enviado ao JunqLife.' : 'Confira sinal GPS, internet e permissões.')
    } catch (error) {
      Alert.alert('Erro no GPS', error instanceof Error ? error.message : 'Confira as permissões do aparelho.')
    } finally {
      setTrackingBusy(false)
    }
  }

  const handleSignOut = async () => {
    try {
      if (TRACKING_SUPPORTED && trackingActive) {
        await stopTracking()
      }
    } finally {
      await supabase.auth.signOut()
    }
  }

  const handleInvite = async (circle: Circle) => {
    setBusy(true)
    try {
      const code = await createInvite(circle.id)
      setGeneratedCode(code)
    } catch (error) {
      Alert.alert('Não foi possível gerar', error instanceof Error ? error.message : 'Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>JUNQLIFE</Text>
            <Text style={styles.heading}>Buenas, {displayName}.</Text>
          </View>
          <Pressable onPress={handleSignOut}>
            <Text style={styles.link}>Sair</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Seu círculo começa aqui.</Text>
          <Text style={styles.heroText}>Crie um grupo ou entre com o código de alguém. Localização continua desligada até você permitir.</Text>
        </View>

        <View style={styles.trackingCard}>
          <View style={styles.circleTop}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>Rastreamento deste aparelho</Text>
              <Text style={styles.trackingDescription}>
                {TRACKING_SUPPORTED
                  ? trackingActive
                    ? 'Ativo em segundo plano. Só os círculos autorizados conseguem ver sua posição.'
                    : 'Desligado. O GPS não é enviado pelo JunqLife.'
                  : 'Disponível no app Android/iOS usando Development Build.'}
              </Text>
            </View>
            <View style={[styles.statusDot, trackingActive && styles.statusDotActive]} />
          </View>

          <Button
            title={trackingBusy ? 'Processando...' : trackingActive ? 'Parar rastreamento' : 'Iniciar rastreamento'}
            onPress={handleTracking}
            disabled={!TRACKING_SUPPORTED || trackingBusy}
          />
          <Button
            title="Enviar posição agora"
            onPress={handlePositionNow}
            secondary
            disabled={!TRACKING_SUPPORTED || trackingBusy}
          />
          <Button
            title="Diagnóstico GPS"
            onPress={() => router.push('/diagnostics')}
            secondary
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Criar círculo</Text>
          <TextInput
            value={newCircle}
            onChangeText={setNewCircle}
            placeholder="Ex.: Família, Junq, Amigos"
            style={styles.input}
          />
          <Button title="Criar círculo" onPress={handleCreate} disabled={busy} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrar com convite</Text>
          <TextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="ABCDEFGH"
            autoCapitalize="characters"
            maxLength={11}
            style={[styles.input, styles.codeInput]}
          />
          <Button title="Entrar no círculo" onPress={handleJoin} secondary disabled={busy} />
        </View>

        {generatedCode && (
          <View style={styles.inviteCard}>
            <Text style={styles.inviteLabel}>CÓDIGO DE CONVITE</Text>
            <Text style={styles.inviteCode}>{generatedCode}</Text>
            <Text style={styles.inviteHelp}>Válido por 24h e até 10 usos. Compartilhe somente com quem você quer no círculo.</Text>
            <Pressable onPress={() => setGeneratedCode(null)}>
              <Text style={styles.link}>Fechar</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Seus círculos</Text>
          <Pressable onPress={refresh}><Text style={styles.link}>Atualizar</Text></Pressable>
        </View>

        {circles.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum círculo ainda</Text>
            <Text style={styles.emptyText}>Crie o primeiro acima ou peça um código para entrar.</Text>
          </View>
        ) : (
          circles.map((circle) => {
            const isOwner = circle.owner_id === user?.id
            const enabled = Boolean(sharing[circle.id])

            return (
              <View key={circle.id} style={styles.circleCard}>
                <View style={styles.circleTop}>
                  <View style={styles.flex}>
                    <Text style={styles.circleName}>{circle.name}</Text>
                    <Text style={styles.circleRole}>{isOwner ? 'Owner' : 'Membro'}</Text>
                  </View>
                  {isOwner && (
                    <Pressable onPress={() => handleInvite(circle)} disabled={busy}>
                      <Text style={styles.link}>Convidar</Text>
                    </Pressable>
                  )}
                </View>

                <Button
                  title="Abrir mapa ao vivo"
                  onPress={() => router.push({ pathname: '/map', params: { circleId: circle.id } })}
                  secondary
                />

                <View style={styles.sharingRow}>
                  <View style={styles.flex}>
                    <Text style={styles.sharingTitle}>Compartilhar localização</Text>
                    <Text style={styles.sharingText}>{enabled ? 'Ligado para este círculo' : 'Desligado por padrão'}</Text>
                  </View>
                  <Switch value={enabled} onValueChange={(value) => toggleSharing(circle.id, value)} />
                </View>
              </View>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

export default function Index() {
  const { loading, user, recoveryMode } = useAuth()

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  if (recoveryMode && user) return <RecoveryScreen />
  return user ? <HomeScreen /> : <AuthScreen />
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { alignItems: 'center', justifyContent: 'center' },
  page: { padding: 20, paddingBottom: 60, gap: 16 },
  authPage: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 28 },
  brandBlock: { gap: 6 },
  brand: { fontSize: 42, fontWeight: '900', letterSpacing: -1.5, color: '#101418' },
  subtitle: { fontSize: 16, color: '#65707B' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: '#68737E' },
  heading: { fontSize: 28, fontWeight: '800', color: '#101418', marginTop: 4 },
  hero: { backgroundColor: '#101418', borderRadius: 28, padding: 24, gap: 8 },
  heroTitle: { color: 'white', fontSize: 26, fontWeight: '800' },
  heroText: { color: '#C5CDD5', lineHeight: 21 },
  card: { backgroundColor: 'white', padding: 20, borderRadius: 22, gap: 12 },
  trackingCard: { backgroundColor: '#E8F7EE', padding: 20, borderRadius: 22, gap: 12 },
  trackingDescription: { color: '#587064', lineHeight: 19, marginTop: 4 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#AAB5AF' },
  statusDotActive: { backgroundColor: '#18A558' },
  cardTitle: { fontSize: 19, fontWeight: '800', color: '#151A1F' },
  input: { backgroundColor: '#F2F4F6', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, color: '#101418' },
  codeInput: { letterSpacing: 3, fontWeight: '800', textAlign: 'center' },
  button: { backgroundColor: '#101418', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#E8ECEF' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 15 },
  buttonSecondaryText: { color: '#101418' },
  link: { color: '#356AE6', fontWeight: '700' },
  linkMuted: { color: '#66727C', fontWeight: '700', marginTop: 2 },
  recoveryHelp: { color: '#66727C', lineHeight: 20 },
  inviteCard: { backgroundColor: '#E7F0FF', padding: 22, borderRadius: 22, gap: 8 },
  inviteLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#4B658E' },
  inviteCode: { fontSize: 36, fontWeight: '900', letterSpacing: 5, color: '#163E84' },
  inviteHelp: { color: '#536B8D', lineHeight: 20, marginBottom: 4 },
  sectionHeader: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: '#151A1F' },
  empty: { backgroundColor: '#E9EDF0', padding: 22, borderRadius: 22 },
  emptyTitle: { fontWeight: '800', fontSize: 17, color: '#303941' },
  emptyText: { color: '#66727C', marginTop: 5 },
  circleCard: { backgroundColor: 'white', padding: 20, borderRadius: 22, gap: 16 },
  circleTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleName: { fontSize: 20, fontWeight: '800', color: '#151A1F' },
  circleRole: { color: '#77818A', marginTop: 2 },
  sharingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDE2E6' },
  sharingTitle: { fontWeight: '700', color: '#252C32' },
  sharingText: { color: '#7A858E', fontSize: 13, marginTop: 2 },
  flex: { flex: 1 },
})
