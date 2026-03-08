
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function diagnose() {
  const { data, error } = await supabase.from('assignments').select('*').limit(1);
  if (data && data.length > 0) {
      console.log('Assignments Columns:', Object.keys(data[0]));
  } else {
      console.log('Assignments table is empty or could not be reached.');
  }

  const { data: noteData } = await supabase.from('notes').select('*').limit(1);
  if (noteData && noteData.length > 0) {
      console.log('Notes Columns:', Object.keys(noteData[0]));
  }
}

diagnose();
