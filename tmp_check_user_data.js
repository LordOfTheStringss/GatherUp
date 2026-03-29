require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUserData() {
  console.log('Fetching user data...');
  
  // Search by exact ID from logs
  const userId = '08b521f0-a189-47ca-b986-0b7188b6006c';
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, profile_image, status, badges, reputation_score')
    .eq('id', userId);

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Recent Users (Last 5):');
    data.forEach(user => {
      console.log('-------------------');
      console.log('ID:', user.id);
      console.log('Email:', user.email);
      console.log('Name:', user.full_name);
      console.log('Profile Image URL:', user.profile_image);
      console.log('Status:', user.status);
      console.log('Badges:', JSON.stringify(user.badges));
      console.log('Reputation:', user.reputation_score);
    });
  } else {
    console.log('No users found in table.');
  }
}

checkUserData();
