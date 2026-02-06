const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
try {
  const envPath = path.resolve(__dirname, '../.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      process.env[key] = value;
    }
  });
} catch (err) {
  console.error('Error reading .env.local:', err.message);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log('Checking Subjects Table...');
  
  // 1. Check a sample subject
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching subjects:', error);
  } else if (subjects.length === 0) {
    console.log('Subjects table is empty.');
  } else {
    console.log('Sample Subject:', JSON.stringify(subjects[0], null, 2));
    console.log('ID Type:', typeof subjects[0].id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjects[0].id);
    console.log('Is ID UUID?', isUuid);
    
    if (!isUuid) {
      console.log('CRITICAL: Subject ID is NOT a UUID!');
    }
  }

  // 2. Check Teacher Classes to see what "subjects" looks like
  console.log('\nChecking Teacher Classes...');
  const { data: teacherClasses, error: tcError } = await supabase
    .from('teacher_classes')
    .select('*')
    .limit(1);
    
  if (tcError) {
    console.error('Error fetching teacher_classes:', tcError);
  } else if (teacherClasses && teacherClasses.length > 0) {
    console.log('Sample Teacher Class Subjects:', JSON.stringify(teacherClasses[0].subjects, null, 2));
  }
}

checkDb();
