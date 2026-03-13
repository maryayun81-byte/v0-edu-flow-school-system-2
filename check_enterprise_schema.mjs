import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  const tables = ['assignment_pages', 'assignment_questions', 'student_question_answers', 'question_markings', 'assignment_analytics'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .limit(1);
    
    if (error) {
      console.log(`Table ${table} check failed: ${error.message}`);
    } else {
      console.log(`Table ${table} exists.`);
    }
  }
}

checkTables().catch(console.error);
