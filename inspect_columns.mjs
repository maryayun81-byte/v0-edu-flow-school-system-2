import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error) {
    console.error(`Error inspecting ${tableName}:`, error.message);
  } else {
    // Try to get columns from an empty table by checking the error message or common fields
    console.log(`--- Table: ${tableName} ---`);
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    } else {
      console.log('Table is empty. Trying to find columns via alternative method...');
      // We can use a trick to get column names from an empty table by querying a non-existent column
      const { error: colError } = await supabase.from(tableName).select('non_existent_column').limit(1);
      console.log('Alternative check (error might contain columns):', colError?.message);
    }
  }
}

async function run() {
  await inspectTable('audit_logs');
  await inspectTable('intelligence_insights');
}

run().catch(console.error);
