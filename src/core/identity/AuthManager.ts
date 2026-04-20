import { SupabaseClient } from '../../infra/SupabaseClient';
import { VectorService } from '../../intelligence/VectorService';
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

    public async register(data: { email: string, password: string, fullName: string, username: string, age: string, baseLocation?: string }): Promise<{ success: boolean; userId?: string }> {
        const email = data.email.trim();
        const password = data.password.trim();
        const username = data.username.trim();
        const ageNum = parseInt(data.age);

        if (isNaN(ageNum) || ageNum < 18) {
            const { AgeRestrictedException } = await import('./Exceptions');
            throw new AgeRestrictedException();
        }

        if (!(await this.validateDomain(email))) {
            throw new InvalidDomainException();
        }

        // Check if username is already taken in the public.users table
        const { data: existingUser, error: checkError } = await this.supabaseClient.client
            .from('users')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        if (existingUser) {
            throw new Error("This username is already taken.");
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
            if (error.message.includes('already registered')) {
                throw new Error("An account with this email address already exists.");
            }
            throw new Error(error.message);
        }

        // Explicitly update base_location in the users table to handle any trigger mapping issues
        if (authData.user?.id && data.baseLocation) {
            const { error: dbError } = await this.supabaseClient.client
                .from('users')
                .update({ base_location: data.baseLocation })
                .eq('id', authData.user.id);
            
            if (dbError) {
                console.error("Failed to explicitly set base_location:", dbError);
            }
        }

        VectorService.getInstance().generateUserEmbedding(authData.user.id)
            .catch((e: any) => console.error("Initial embedding generation failed:", e));

        return { success: true, userId: authData.user?.id };
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
            // STRICT BOUNCER: Check if user is banned immediately after sign-in
            const { data: userProfile, error: statusError } = await this.supabaseClient.client
                .from('users')
                .select('status')
                .eq('id', data.session.user.id)
                .single();

            if (userProfile?.status?.toLowerCase() === 'banned') {
                await this.supabaseClient.client.auth.signOut();

                // Show notification before throwing
                const { Alert } = await import('react-native');
                Alert.alert(
                    'Account Suspended',
                    'Your account has been restricted by an administrator.',
                    [{ text: 'OK' }]
                );

                throw new Error("Your account has been suspended by an administrator.");
            }

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

    public async validateDomain(email: string): Promise<boolean> {
        const lowerEmail = email.toLowerCase();
        const parts = lowerEmail.split('@');

        if (parts.length !== 2) {
            return false;
        }

        const extractedDomain = parts[1];

        const { data, error } = await this.supabaseClient.client
            .from('allowed_domains')
            .select('domain');

        if (error || !data || data.length === 0) {
            console.warn(`Registration blocked: Could not fetch allowed_domains or table is empty.`);
            return false;
        }

        const isAllowed = data.some((row: { domain: string }) => {
            const allowed = row.domain.toLowerCase();
            return extractedDomain === allowed || extractedDomain.endsWith(`.${allowed}`);
        });

        if (!isAllowed) {
            console.warn(`Registration blocked: Domain '${extractedDomain}' does not match any allowed domain suffix.`);
        }

        return isAllowed;
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
