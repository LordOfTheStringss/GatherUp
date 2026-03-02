import { NotificationService } from '../../infra/NotificationService';
import { SupabaseClient } from '../../infra/SupabaseClient';

export class FriendshipManager {
    private supabaseClient: any;
    private notificationService: NotificationService;

    constructor(notificationService: NotificationService) {
        this.supabaseClient = SupabaseClient.getInstance();
        this.notificationService = notificationService;
    }

    public async sendRequest(from: string, to: string): Promise<void> {
        const { error } = await this.supabaseClient.client.from('friendships').insert({ user_id: from, friend_id: to });
        if (error) {
            console.error('sendRequest error:', error);
            throw new Error(error.message);
        }

        // Fetch sender name
        const { data: sender } = await this.supabaseClient.client.from('users').select('full_name').eq('id', from).single();
        if (sender) {
            await this.notificationService.sendFriendRequestNotification(to, sender.full_name, from);
        }
    }

    public async acceptRequest(me: string, them: string): Promise<void> {
        // me accepts them => me inserts them
        const { error } = await this.supabaseClient.client.from('friendships').insert({ user_id: me, friend_id: them });
        if (error) {
            console.error('acceptRequest error:', error);
            throw new Error(error.message);
        }
    }

    public async rejectRequest(me: string, them: string): Promise<void> {
        // me rejects them => delete their row pointing to me
        const { error } = await this.supabaseClient.client.from('friendships')
            .delete()
            .match({ user_id: them, friend_id: me });
        if (error) {
            console.error('rejectRequest error:', error);
            throw new Error(error.message);
        }
    }

    public async removeFriend(me: string, them: string): Promise<void> {
        // Mutually delete
        await this.supabaseClient.client.from('friendships').delete().match({ user_id: me, friend_id: them });
        await this.supabaseClient.client.from('friendships').delete().match({ user_id: them, friend_id: me });
    }

    public async getPendingRequests(userId: string): Promise<any[]> {
        // Users who follow me, but I don't follow them
        const { data: whoFollowsMe, error } = await this.supabaseClient.client
            .from('friendships')
            .select(`user_id, users!friendships_user_id_fkey(full_name, id)`)
            .eq('friend_id', userId);

        if (error) throw new Error(error.message);

        const { data: whoIFollow, error: e2 } = await this.supabaseClient.client
            .from('friendships')
            .select('friend_id')
            .eq('user_id', userId);

        if (e2) throw new Error(e2.message);

        const myFollowingIds = whoIFollow.map((f: any) => f.friend_id);

        const pending = (whoFollowsMe || []).filter((req: any) => !myFollowingIds.includes(req.user_id));
        return pending.map((p: any) => p.users);
    }

    public async getTrustedCircle(userId: string): Promise<any[]> {
        // Mutual follows
        const { data: whoFollowsMe, error } = await this.supabaseClient.client
            .from('friendships')
            .select(`user_id, users!friendships_user_id_fkey(full_name, id)`)
            .eq('friend_id', userId);

        if (error) throw new Error(error.message);

        const { data: whoIFollow, error: e2 } = await this.supabaseClient.client
            .from('friendships')
            .select('friend_id')
            .eq('user_id', userId);

        if (e2) throw new Error(e2.message);

        const myFollowingIds = whoIFollow.map((f: any) => f.friend_id);

        const friends = (whoFollowsMe || []).filter((req: any) => myFollowingIds.includes(req.user_id));
        return friends.map((p: any) => p.users);
    }
}
