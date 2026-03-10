import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanData() {
  console.log('--- Cleaning Profile form_class casing ---');
  const { data: profiles } = await supabase.from('profiles').select('id, form_class').not('form_class', 'is', null);
  
  for (const p of (profiles || [])) {
    const lower = p.form_class.toLowerCase().trim();
    if (lower !== p.form_class) {
      console.log(`Updating ${p.id}: "${p.form_class}" -> "${lower}"`);
      await supabase.from('profiles').update({ form_class: lower }).eq('id', p.id);
    }
  }

  console.log('\n--- Cleaning Classes name casing ---');
  const { data: classes } = await supabase.from('classes').select('id, name');
  for (const c of (classes || [])) {
    const lower = c.name.toLowerCase().trim();
    if (lower !== c.name) {
      console.log(`Updating Class ${c.id}: "${c.name}" -> "${lower}"`);
      await supabase.from('classes').update({ name: lower }).eq('id', c.id);
    }
  }

  console.log('\nDone.');
}

cleanData().catch(console.error).finally(() => process.exit(0));
