const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkParticipantsRel() {
  const { data, error } = await supabase
    .from('event_participants')
    .select('user_id, users!event_participants_user_id_fkey (id, full_name)')
    .limit(1);
    
  if (error) {
    console.error('Error with event_participants join:', JSON.stringify(error, null, 2));
    return;
  }
  console.log('Join successful:', JSON.stringify(data, null, 2));
}

checkParticipantsRel();
