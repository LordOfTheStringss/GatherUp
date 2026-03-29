require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStorage() {
  console.log('Checking storage buckets...');
  const { data, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('Error listing buckets:', error);
    return;
  }

  console.log('Buckets found:');
  data.forEach(bucket => {
    console.log(`- Name: ${bucket.name}, Public: ${bucket.public}`);
  });

  console.log('Listing files in "avatars" bucket...');
  const { data: files, error: fileError } = await supabase
    .storage
    .from('avatars')
    .list();

  if (fileError) {
    console.error('Error listing files:', fileError);
    return;
  }

  console.log(`Files found (${files.length}):`);
  files.forEach(file => {
    console.log(`- ${file.name} (${file.metadata?.size} bytes)`);
  });
}

checkStorage();
