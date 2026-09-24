import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://hgthtzihywggrmnuwhog.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_iYciJ-2Hmb3dSjvBuwosyw_8UncB6UD'

const browserStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, value)
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(key)
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: browserStorage,
    storageKey: 'junqlife.auth.session.v2',
    autoRefreshToken: typeof window !== 'undefined',
    persistSession: true,
    detectSessionInUrl: typeof window !== 'undefined',
  },
})
