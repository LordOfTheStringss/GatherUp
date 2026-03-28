
import { SupabaseClient } from './src/infra/SupabaseClient';

async function testSchema() {
    try {
        const { data, error } = await SupabaseClient.getInstance().client
            .from('events')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Error fetching event:', error);
            return;
        }
        
        if (data && data.length > 0) {
            console.log('Available columns in events table:', Object.keys(data[0]));
        } else {
            console.log('No data in events table to determine schema.');
        }
    } catch (e) {
        console.error('Test failed:', e);
    }
}

testSchema();
