import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Manages the persistent connection to the Supabase backend, handling database queries,
 * realtime subscriptions, and serverless function invocations. <<Singleton>>
 */
export class SupabaseClient {
    private static instance: SupabaseClient;
    public client: any;

    private constructor() {
        this.client = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                storage: AsyncStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
    }

    public static getInstance(): SupabaseClient {
        if (!SupabaseClient.instance) {
            SupabaseClient.instance = new SupabaseClient();
        }
        return SupabaseClient.instance;
    }

    /**
     * Executes a secure SQL-like query via the PostgREST API.
     */
    public async query(table: string, params: any): Promise<any> {
        // Stub implementation wrapping the generic select
        return await this.client.from(table).select(params);
    }

    /**
     * Listens for realtime database changes (e.g., new chat messages) via WebSockets.
     */
    public subscribe(channel: string, callback: Function): void {
        this.client
            .channel(channel)
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
                callback(payload);
            })
            .subscribe();
    }

    /**
     * Triggers a serverless Deno function for complex logic.
     */
    public async invokeEdgeFunction(funcName: string, payload: any): Promise<any> {
        return await this.client.functions.invoke(funcName, {
            body: payload,
        });
    }
}
