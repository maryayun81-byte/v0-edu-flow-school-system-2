import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
  const tables = ['audit_logs', 'intelligence_insights', 'student_results', 'notifications'];
  for (const table of tables) {
    console.log(`--- Checking RLS for ${table} ---`);
    // Try to insert a dummy row to see if it fails with RLS error
    const { error } = await supabase.from(table).insert({}).limit(0); 
    if (error) {
      console.log(`RLS Info for ${table}:`, error.message);
    } else {
      console.log(`RLS for ${table} might be open or allowed for service role.`);
    }
  }
}

checkRLS().catch(console.error);
