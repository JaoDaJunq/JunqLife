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

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
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
