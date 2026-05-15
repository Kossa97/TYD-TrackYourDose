import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xcskcojakolphtbuqfbw.supabase.co'
const supabaseAnonKey = 'sb_publishable_yeAVlq8miTc20FLsPqKCwQ_xAGKHLV1'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
