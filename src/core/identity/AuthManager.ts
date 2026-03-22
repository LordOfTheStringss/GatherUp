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

    public async register(data: { email: string, password: string, fullName: string, username: string, age: string, baseLocation?: string }): Promise<boolean> {
        const email = data.email.trim();
        const password = data.password.trim();
        const username = data.username.trim();
        const ageNum = parseInt(data.age);

        if (isNaN(ageNum) || ageNum < 18) {
            const { AgeRestrictedException } = await import('./Exceptions');
            throw new AgeRestrictedException();
        }

        if (!this.validateDomain(email)) {
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

        // Trigger initial embedding generation
        // After auth.signUp, the user record might take a moment to sync to public.users via triggers
        // We call it with default/initial values
        const status = email.endsWith('.edu.tr') ? 'öğrenci' : 'çalışan';
        if (authData.user) {
            // Force base_location update in case the Supabase trigger missed it from raw_user_meta_data
            if (data.baseLocation) {
                await this.supabaseClient.client
                    .from('users')
                    .update({ base_location: data.baseLocation })
                    .eq('id', authData.user.id)
                    .then(({ error }: any) => {
                        if (error) console.error("Failed to force update base_location:", error);
                    });
            }

            VectorService.getInstance().generateUserEmbedding(authData.user.id, 0, status, [], true)
                .catch((e: any) => console.error("Initial embedding generation failed:", e));
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
        const lowerEmail = email.toLowerCase();

        // 1. Allow any student emails
        if (lowerEmail.endsWith('.edu') || lowerEmail.endsWith('.edu.tr')) {
            return true;
        }

        // 2. Specific corporate whitelisted domains
        const whitelistedDomains = [
            // Savunma Sanayi ve Havacılık
            '@aselsan.com.tr',
            '@havelsan.com.tr',
            '@roketsan.com.tr',
            '@tusas.com',
            '@tai.com.tr',
            '@baykartech.com',
            '@stm.com.tr',
            '@tei.com.tr',
            '@tubitak.gov.tr',
            // Teknoloji, E-Ticaret ve Telekomünikasyon
            '@trendyol.com',
            '@hepsiburada.com',
            '@getir.com',
            '@turkcell.com.tr',
            '@turktelekom.com.tr',
            '@vodafone.com.tr',
            '@logo.com.tr',
            // Dev Holdingler ve Global Şirketler
            '@thy.com',
            '@koc.com.tr',
            '@sabanci.com',
            '@eczacibasi.com.tr',
            // Finans ve Bankacılık
            '@garantibbva.com.tr',
            '@isbank.com.tr',
            '@akbank.com',
            '@yapikredi.com.tr'
        ];

        return whitelistedDomains.some(domain => lowerEmail.endsWith(domain));
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
