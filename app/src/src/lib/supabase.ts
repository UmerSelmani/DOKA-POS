import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gccoryxqnfxmiwtgmwvu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjY29yeXhxbmZ4bWl3dGdtd3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NTgyNDUsImV4cCI6MjA4NzAzNDI0NX0._TCZG4IHnMABCrWjUVJyiUKN6k9F96cyCpm00CAES_k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});
