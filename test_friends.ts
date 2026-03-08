import { SupabaseClient } from './src/infra/SupabaseClient';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const sClient = SupabaseClient.getInstance().client;
    // get a user
    const { data: user } = await sClient.from('users').select('id, full_name').limit(1).single();
    if (!user) return console.log("No user");
    console.log("Testing user:", user);

    const { data: friendships, error } = await sClient
        .from('friendships')
        .select('*')
        .eq('status', 'accepted')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
    
    console.log("Friendships:", friendships, error);
}
main();
