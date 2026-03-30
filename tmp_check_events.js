const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvents() {
    const { data: events } = await supabase
        .from('events')
        .select('id, title, start_time, end_time, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
    
    fs.writeFileSync('tmp_events.json', JSON.stringify({
        localTime: new Date().toString(),
        utcTime: new Date().toISOString(),
        events: events
    }, null, 2));
}
checkEvents();
