import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching events with nested popularity...");
    const { data, error } = await supabase
        .from('events')
        .select('id, title, popularity:event_popularity_scores(*)')
        .limit(1);

    console.log('Data:', JSON.stringify(data, null, 2));
    if (error) {
        console.error('Error:', JSON.stringify(error, null, 2));
    }
}

run();
