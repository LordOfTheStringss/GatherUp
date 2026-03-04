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

    public async register(data: { email: string, password: string, fullName: string, username: string, age: string, baseLocation?: string }): Promise<boolean> {
        const email = data.email.trim();
        const password = data.password.trim();
        const username = data.username.trim();

        if (!this.validateDomain(email)) {
            throw new InvalidDomainException();
        }

        const { data: authData, error } = await this.supabaseClient.client.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: data.fullName,
                    username: data.username,
                    age: data.age,
                    base_location: data.baseLocation || ''
                }
            }
        });

        if (error) {
            console.error('Registration failed:', error);
            throw new Error(error.message);
        }

        return true;
    }

    public async login(identifier: string, pass: string): Promise<any> {
        const cleanIdentifier = identifier.trim();
        let loginEmail = cleanIdentifier;

        // If it's not an email format, assume it's a username and try to look up the email
        if (!cleanIdentifier.includes('@')) {
            const { data: userRecord, error: userError } = await this.supabaseClient.client
                .from('users')
                .select('email')
                .eq('username', cleanIdentifier)
                .single();

            if (userError || !userRecord) {
                console.error('Username lookup failed:', userError);
                throw new Error("Invalid username or password.");
            }
            loginEmail = userRecord.email;
        }

        const { data, error } = await this.supabaseClient.client.auth.signInWithPassword({
            email: loginEmail,
            password: pass,
        });

        if (error) {
            console.error('Login failed:', error);
            if (error.message.includes('fetch') || error.message.includes('Network')) {
                throw new Error("Network error. Please check your internet connection.");
            }
            // Pass the specific error message from Supabase (e.g., "Email not confirmed")
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
