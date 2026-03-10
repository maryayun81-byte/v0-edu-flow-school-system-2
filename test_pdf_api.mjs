import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const transcriptId = '607ac85d-550c-4418-93ca-9694f16c9aeb'; // From user error

async function testPdf() {
  console.log('Testing PDF generation for:', transcriptId);
  const url = `http://localhost:3000/api/transcripts/${transcriptId}/pdf`;
  
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.substring(0, 500));
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testPdf();
