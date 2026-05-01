import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cuuwcasasntnrzxgluve.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1dXdjYXNhc250bnJ6eGdsdXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODc2NTksImV4cCI6MjA5MzA2MzY1OX0.KE7k1iD5OogzjqpFqIiLgcWIltZmG-4lV-vr7LjDCl4'

export const supabase = createClient(supabaseUrl, supabaseKey)  