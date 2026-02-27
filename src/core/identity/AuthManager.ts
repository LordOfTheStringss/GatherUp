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

    public async register(email: string, pass: string): Promise<boolean> {
        if (!this.validateDomain(email)) {
            throw new InvalidDomainException();
        }
        // 1. Validates Domain. 
        // 2. Creates Supabase Auth user. 
        // 3. Emits USER_REGISTERED.
        return true;
    }

    public async login(email: string, pass: string): Promise<any> {
        // 1. Authenticates. 
        // 2. Checks isVerified. 
        // 3. Loads currentUser.
        return {}; // Returns Session
    }

    public validateDomain(email: string): boolean {
        // Regex check: check Whitelisted_Domains.
        return email.endsWith('.edu.tr'); // Basic implementation
    }

    public async logout(): Promise<void> {
        // Clears local session, currentUser, and closes WebSocket.
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
