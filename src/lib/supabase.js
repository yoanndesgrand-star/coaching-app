import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://piaeboemsrpfxepissbt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpYWVib2Vtc3JwZnhlcGlzc2J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDYxOTgsImV4cCI6MjA5MjUyMjE5OH0.Nv-CxKaWgwIfCK4c-DOSgEVdi_js6YkdRaJ2cx0j0J4'

export const supabase = createClient(supabaseUrl, supabaseKey)
