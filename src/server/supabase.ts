import { SUPABASE_KEY, SUPABASE_URL } from './config.ts';
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export default supabase;
