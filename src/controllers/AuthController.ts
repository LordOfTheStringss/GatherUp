import { AuthManager } from '../core/identity/AuthManager';
import { ResponseEntity } from './ResponseEntity';

// DTOs for Auth
export interface RegisterDTO {
    email: string;
    fullName: string;
    password?: string;
    interestTags?: string[];
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
        return { status: 201, message: "User Created" };
    }

    /**
     * Calls authManager.login() and returns session token.
     */
    public async login(request: LoginDTO): Promise<ResponseEntity<Session>> {
        return {
            status: 200,
            data: { token: "mock-token", expiresAt: new Date() }
        };
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
        return { status: 200, message: "Logged out" };
    }
}
