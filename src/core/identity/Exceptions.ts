export class InvalidDomainException extends Error {
    constructor(message: string = "Exclusive to university students.") {
        super(message);
        this.name = "InvalidDomainException";
    }
}

export class VerificationPendingException extends Error {
    constructor(message: string = "Check your Inbox.") {
        super(message);
        this.name = "VerificationPendingException";
    }
}

export class UnauthorizedAccessException extends Error {
    constructor(message: string = "Not allowed to access this private event.") {
        super(message);
        this.name = "UnauthorizedAccessException";
    }
}

export class AccountSuspendedException extends Error {
    constructor(message: string = "Account is suspended by Admin.") {
        super(message);
        this.name = "AccountSuspendedException";
    }
}
