import { User } from '../../core/identity/User';
import { DomainIntegrityException, InvalidDomainFormatException } from './Exceptions';

/**
 * Manages the registry of allowed institutional email domains.
 * Ensures only users from verified organizations can register.
 */
export class DomainWhitelister {
    private allowedDomains: string[];

    constructor() {
        // A cached list of authorized suffixes
        this.allowedDomains = ['.edu.tr', 'aselsan.com.tr'];
    }

    /**
     * Validates the domain format (Regex) and adds it to the whitelist.
     */
    public addDomain(domain: string): boolean {
        // Regex validation: Must have at least a dot and a valid TLD
        const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain)) {
            throw new InvalidDomainFormatException();
        }

        if (!this.allowedDomains.includes(domain)) {
            this.allowedDomains.push(domain);
            return true;
        }
        return false;
    }

    /**
     * Removes a domain from the whitelist, preventing new registrations.
     * Throws DomainIntegrityException if users are still active.
     */
    public removeDomain(domain: string): void {
        const activeUsersCount = 0; // Stub: query DB for count
        if (activeUsersCount > 0) {
            throw new DomainIntegrityException();
        }

        this.allowedDomains = this.allowedDomains.filter(d => d !== domain);
    }

    /**
     * Returns a list of all active users currently registered under a specific domain.
     * Critical for impact analysis before removing a domain.
     */
    public auditDomainRegistration(domain: string): User[] {
        // Stub: query database for users with matching email suffix
        return [];
    }
}
