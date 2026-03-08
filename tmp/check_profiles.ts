
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function diagnose() {
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, role, form_class').limit(20);
  console.log('Profiles Sample:', profiles);

  const { data: roles } = await supabase.from('profiles').select('role').limit(100);
  const uniqueRoles = [...new Set(roles?.map(r => r.role))];
  console.log('Unique Roles in DB:', uniqueRoles);
}

diagnose();
