import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  const tables = ['audit_logs', 'intelligence_insights', 'student_results'];
  for (const table of tables) {
    console.log(`--- Checking ${table} ---`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error checking ${table}:`, error.message);
    } else {
      console.log(`${table} exists. Columns:`, data.length > 0 ? Object.keys(data[0]) : 'Empty table');
    }
  }
}

checkTables().catch(console.error);
