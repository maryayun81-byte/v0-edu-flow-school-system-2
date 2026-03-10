import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function applySql() {
  const sqlFile = process.argv[2];
  if (!sqlFile) {
    console.error('Usage: node apply_sql.mjs <file.sql>');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, 'utf8');
  console.log(`Applying SQL from ${sqlFile}...`);

  // Supabase JS doesn't have a direct 'query' method for raw SQL.
  // We usually use a helper RPC if available, or just use the API for specific tasks.
  // However, I can try to use the Postgres REST API directly if I have the role key.
  // Alternatively, I can execute it chunk by chunk if it was just data, but this is DDL.
  
  // Checking if 'exec_sql' RPC exists (common in these environments)
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Error applying SQL:', error);
    process.exit(1);
  }

  console.log('SQL applied successfully.');
}

applySql().catch(console.error);
