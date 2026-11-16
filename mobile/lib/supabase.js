import 'react-native-url-polyfill/auto'
import 'expo-sqlite/localStorage/install'
import { createClient } from '@supabase/supabase-js'

// Same Supabase project and publishable key used by js/supabase.js on the website.
// Publishable keys are intended for client apps; never put a service-role key here.
const SUPABASE_URL = 'https://tqixpmfpqegxkfwqxasa.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_o7zmdOGsLtPWdqTGovFT4Q_vzQE-_G7'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export const SITE_URL = 'https://rocha7.miguel-faria-497.workers.dev'
