const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching user:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('User object keys:', JSON.stringify(Object.keys(data[0]), null, 2));
  } else {
    console.log('No users found in table.');
  }
}

checkSchema();
