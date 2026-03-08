
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function diagnose() {
  console.log('--- Diagnosing Preferences Error ---');

  // 1. Check if teacher_subject_preferences table exists
  const { error: tableError } = await supabase.from('teacher_subject_preferences').select('count').limit(1);
  if (tableError) {
      console.log('teacher_subject_preferences table error:', tableError.message);
  } else {
      console.log('teacher_subject_preferences table exists.');
  }

  // 2. Check profiles columns
  const { data: profileSample, error: profileError } = await supabase.from('profiles').select('*').limit(1);
  if (profileSample && profileSample.length > 0) {
      console.log('Profiles Columns:', Object.keys(profileSample[0]));
      if (Object.keys(profileSample[0]).includes('onboarding_completed')) {
          console.log('onboarding_completed column exists.');
      } else {
          console.log('onboarding_completed column is MISSING.');
      }
  } else {
      console.log('Profiles table is empty or could not be reached.');
  }

  console.log('--- Diagnosis Complete ---');
}

diagnose();
