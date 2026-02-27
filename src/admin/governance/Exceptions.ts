export class DomainIntegrityException extends Error {
    constructor(message: string = "Cannot remove domain; there are still active users registered under it.") {
        super(message);
        this.name = "DomainIntegrityException";
    }
}

export class QuotaServiceUnreachableException extends Error {
    constructor(message: string = "External metering APIs (Supabase/Google) timed out. Falling back to cached usage metrics.") {
        super(message);
        this.name = "QuotaServiceUnreachableException";
    }
}

export class InvalidDomainFormatException extends Error {
    constructor(message: string = "The input string violates the required Regex pattern (e.g., missing TLD).") {
        super(message);
        this.name = "InvalidDomainFormatException";
    }
}
