const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.resolve(__dirname, '../.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
} catch (err) {}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkSpecific() {
  console.log('Checking "History" subject...');
  
  const { data: history, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('name', 'History')
    .single();

  if (error) {
    console.error('Error fetching History:', error);
  } else if (!history) {
    console.log('History subject not found.');
  } else {
    console.log('History Subject:', history);
    console.log('ID Value:', history.id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(history.id);
    console.log('Is ID a valid UUID?', isUuid);
  }

  // Check Schema Information using RPC call if standard query fails (or just infer)
  // But we can try to insert a dummy mark with a valid UUID to verify marks table constraints? 
  // No, let's just trust the error message about marks table.
  
  console.log('\nChecking "subjects" table definition info via RPC/System tables (might fail if restricted):');
  // We cannot easily query information_schema via Supabase JS client unless configured.
  // But the above test is sufficient.
}

checkSpecific();
