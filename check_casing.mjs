import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCasing() {
  const { data: profiles } = await supabase.from('profiles').select('full_name, form_class').in('full_name', ['misa', 'Mojo']);
  
  for (const p of profiles) {
    console.log(`Student: ${p.full_name}`);
    console.log(`Form Class: "${p.form_class}"`);
    console.log(`Hex: ${Buffer.from(p.form_class).toString('hex')}`);
  }

  const { data: classes } = await supabase.from('classes').select('name').ilike('name', 'form 3');
  for (const c of classes) {
    console.log(`Class Name in DB: "${c.name}"`);
    console.log(`Hex: ${Buffer.from(c.name).toString('hex')}`);
  }
}

checkCasing().catch(console.error).finally(() => process.exit(0));
