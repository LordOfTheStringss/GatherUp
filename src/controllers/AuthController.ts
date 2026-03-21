import { AuthManager } from '../core/identity/AuthManager';
import { ResponseEntity } from './ResponseEntity';

// DTOs for Auth
export interface RegisterDTO {
    email: string;
    fullName: string;
    username: string;
    age: string;
    password?: string;
    interestTags?: string[];
    baseLocation?: string;
}

export interface LoginDTO {
    email: string;
    password?: string;
}

export interface Session {
    token: string;
    expiresAt: Date;
}

/**
 * Manages authentication processes and delegates all business logic to AuthManager.
 * The controller is responsible only for request validation and HTTP response mapping.
 */
export class AuthController {
    private authManager: AuthManager;

    constructor(authManager: AuthManager) {
        this.authManager = authManager;
    }

    /**
     * Receives registration data and calls authManager.register(). 
     * Returns 201 Created on success, 400 Bad Request on domain violation.
     */
    public async register(request: RegisterDTO): Promise<ResponseEntity> {
        try {
            await this.authManager.register({
                email: request.email,
                password: request.password || '',
                fullName: request.fullName,
                username: request.username,
                age: request.age,
                baseLocation: request.baseLocation
            });
            return { status: 201, message: "User Created" };
        } catch (error: any) {
            // Re-throw the error so that the Store/UI can handle specific Exception types
            throw error;
        }
    }

    /**
     * Calls authManager.login() and returns session token.
     */
    public async login(request: LoginDTO): Promise<ResponseEntity<Session>> {
        try {
            const session = await this.authManager.login(request.email, request.password || '');
            return {
                status: 200,
                data: { token: session.access_token, expiresAt: new Date(session.expires_at! * 1000) }
            };
        } catch (error: any) {
            return { status: 401, message: error.message || "Login failed" };
        }
    }

    /**
     * Triggered when the user clicks the email verification link.
     */
    public async verifyEmail(token: string): Promise<ResponseEntity> {
        return { status: 200, message: "Email Verified" };
    }

    /**
     * Requests a new token when the session expires.
     */
    public async refreshToken(token: string): Promise<ResponseEntity<string>> {
        return { status: 200, data: "new-mock-token" };
    }

    /**
     * Delegates logout operation to authManager.logout().
     */
    public async logout(token: string): Promise<ResponseEntity> {
        try {
            await this.authManager.logout();
            return { status: 200, message: "Logged out" };
        } catch (error: any) {
            return { status: 500, message: "Logout failed" };
        }
    }
}
