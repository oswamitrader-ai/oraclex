import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rndizeajelkoeacuwiaq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZGl6ZWFqZWxrb2VhY3V3aWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzI2MzUsImV4cCI6MjEwMDQ0ODYzNX0.dYw3o8pG4qIuTS8SKzaS-ympS79QIky5oiLI8iVc2QE'

export const supabase = createClient(supabaseUrl, supabaseKey)
