import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { supabase } from '@/src/lib/supabase'

type AuthContextValue = {
  loading: boolean
  session: Session | null
  user: User | null
  recoveryMode: boolean
  clearRecovery: () => void
}

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  session: null,
  user: null,
  recoveryMode: false,
  clearRecovery: () => {},
})

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    let mounted = true
    let bootstrapped = false

    const bootstrap = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const storedSession = sessionData.session

        if (!storedSession) {
          if (mounted) setSession(null)
          return
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()
        const serverUser = userData.user

        if (userError || !serverUser || serverUser.id !== storedSession.user.id) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
          if (mounted) {
            setSession(null)
            setRecoveryMode(false)
          }
          return
        }

        if (mounted) {
          setSession({ ...storedSession, user: serverUser })
        }
      } finally {
        bootstrapped = true
        if (mounted) setLoading(false)
      }
    }

    void bootstrap()

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return

      // The initial session comes directly from local storage. Bootstrap above
      // validates it against the Auth server before the app trusts it.
      if (event === 'INITIAL_SESSION' && !bootstrapped) return

      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'SIGNED_OUT') setRecoveryMode(false)

      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      recoveryMode,
      clearRecovery: () => setRecoveryMode(false),
    }),
    [loading, session, recoveryMode],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
