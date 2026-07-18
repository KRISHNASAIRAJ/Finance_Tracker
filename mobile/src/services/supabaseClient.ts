import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rkmouoglorsnijmemmcd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5QZUkFFNl0fCdj5peFruNA_4NEZ0H7f';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
