const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('event_participants')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching event_participants:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('event_participants object keys:', JSON.stringify(Object.keys(data[0]), null, 2));
  } else {
    console.log('No participants found in table. Checking columns via RPC or another way...');
    // Try to insert and catch error to see columns or just try a generic select
    const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'event_participants' });
    if (colError) console.log("RPC failed, table might be empty.");
    else console.log("Columns:", cols);
  }
}

checkSchema();
