import 'expo-sqlite/localStorage/install'
import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://hgthtzihywggrmnuwhog.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_iYciJ-2Hmb3dSjvBuwosyw_8UncB6UD'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
