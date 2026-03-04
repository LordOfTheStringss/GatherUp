require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const sClient = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: user } = await sClient.from('users').select('id, full_name, username').limit(2);
    console.log("Users:", user);

    if (user && user.length > 0) {
        let u1 = user[0].id;
        let u2 = user[1].id;
        const { data: friendships, error } = await sClient
            .from('friendships')
            .select('*')
            .eq('status', 'accepted')
            .or(`user_id.eq.${u1},friend_id.eq.${u1}`);

        console.log("Friendships for U1:", friendships, error);
    }
}
main();
