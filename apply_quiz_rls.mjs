import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyRLS() {
  const sql = fs.readFileSync('scripts/fix_quiz_rls.sql', 'utf8');
  
  // We can't run multiple statements via .rpc or other supabase-js methods easily 
  // without a pre-defined RPC function. 
  // So we'll split by semicolon or just run it as one large block if possible.
  // Actually, the best way is to use the 'postgres' RPC if it exists, or individual queries.
  
  // Let's try to run it using a temporary RPC if possible, or just log instructions.
  // Alternatively, I can try to use a more direct approach if the user has a tool for this.
  
  console.log('Attempting to apply RLS via direct SQL execution (requires exec_sql RPC)...');
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Failed to apply SQL via RPC:', error.message);
    console.log('Fallback: Attempting to run statements individually...');
    // Simple split (won't work for complex SQL with semicolon in strings, but good enough for this script)
    const statements = sql.split(';').filter(s => s.trim());
    for (const statement of statements) {
      try {
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (stmtError) console.error(`Statement failed: ${statement.substring(0, 50)}...`, stmtError.message);
      } catch (e) {
        console.error('Error executing statement:', e);
      }
    }
  } else {
    console.log('Successfully applied RLS!');
  }
}

applyRLS().catch(console.error);
