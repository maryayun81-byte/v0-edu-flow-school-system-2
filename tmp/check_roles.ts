
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function diagnose() {
  const { data: userRoles } = await supabase.from('user_roles').select('*').limit(20);
  console.log('User Roles Sample:', userRoles);

  const { data: classes } = await supabase.from('classes').select('*');
  console.log('Classes:', classes);
}

diagnose();
