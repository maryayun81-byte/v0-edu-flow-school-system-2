import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalVerify() {
  const { data: prof } = await supabase.from('profiles').select('id, full_name, form_class').ilike('full_name', 'Mojo').single();
  console.log(`Student Mojo Profile:`, prof);
  
  const { data: cls } = await supabase.from('classes').select('id, name').eq('id', '9d510f4f-32e3-472e-9a64-111a43fe7059').single();
  console.log(`Target Class:`, cls);

  if (prof.form_class === cls.name) {
    console.log('SUCCESS: Brittle RLS match confirmed (strings equal).');
  } else {
    console.log('FAILURE: Strings still do not match exactly.');
  }

  // Final check for sessions visibility for Mojos specific ID
  // Note: we can't fully simulate RLS SELECT as auth.uid() without a JWT,
  // but we've confirmed the logical match.
}

finalVerify().catch(console.error).finally(() => process.exit(0));
