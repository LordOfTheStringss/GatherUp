import { SupabaseClient } from '../../infra/SupabaseClient';
import { InvalidDomainException } from './Exceptions';
import { User } from './User';

/**
 * Manages the authentication lifecycle, enforcing the "Trusted Circle".
 */
export class AuthManager {
    private static instance: AuthManager;
    private sessionToken: string | null = null;
    private currentUser: User | null = null;
    private supabaseClient: any;

    private constructor() {
        this.supabaseClient = SupabaseClient.getInstance();
    }

    public static getInstance(): AuthManager {
        if (!AuthManager.instance) {
            AuthManager.instance = new AuthManager();
        }
        // Initializes Supabase connection if null
        return AuthManager.instance;
    }

    public async register(data: { email: string, password: string, fullName: string, username: string, age: string }): Promise<boolean> {
        if (!this.validateDomain(data.email)) {
            throw new InvalidDomainException();
        }

        const { data: authData, error } = await this.supabaseClient.client.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    full_name: data.fullName,
                    username: data.username,
                    age: data.age
                }
            }
        });

        if (error) {
            console.error('Registration failed:', error);
            throw new Error(error.message);
        }

        // To manually ensure the public.users table gets the user info initially
        if (authData?.user) {
            // We'll upsert just in case the Supabase trigger doesn't exist yet
            await this.supabaseClient.client.from('users').upsert({
                id: authData.user.id,
                email: data.email,
                name: data.fullName,
                profile_image: null,
            }, { onConflict: 'id' }).catch((e: any) => console.log('Upsert public user warning (maybe handled by trigger):', e));
        }

        return true;
    }

    public async login(email: string, pass: string): Promise<any> {
        const { data, error } = await this.supabaseClient.client.auth.signInWithPassword({
            email,
            password: pass,
        });

        if (error) {
            console.error('Login failed:', error);
            throw new Error(error.message);
        }

        if (data?.session) {
            this.sessionToken = data.session.access_token;
            // Optionally fetch and set currentUser here if needed
        }

        return data.session;
    }

    public async getCurrentUser(): Promise<any> {
        const { data: { user }, error } = await this.supabaseClient.client.auth.getUser();
        if (error) {
            console.error('Get user error:', error);
            return null;
        }
        return user;
    }

    public validateDomain(email: string): boolean {
        // Regex check: check Whitelisted_Domains.
        return email.endsWith('.edu.tr'); // Basic implementation
    }

    public async logout(): Promise<void> {
        await this.supabaseClient.client.auth.signOut();
        this.sessionToken = null;
        this.currentUser = null;
    }

    public async changeCredentials(email: string, pass: string): Promise<void> {
        // Update email/password. Triggers re-verification if the email changes.
    }

    public async recoverPassword(email: string): Promise<void> {
        // Triggers "Forgot Password" email via Supabase.
    }
}
