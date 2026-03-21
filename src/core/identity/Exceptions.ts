export class InvalidDomainException extends Error {
    constructor(message: string = "This email is not authorized to join this network. Please use your institutional or corporate email.") {
        super(message);
        this.name = "InvalidDomainException";
    }
}

export class AgeRestrictedException extends Error {
    constructor(message: string = "You must be over 18 to register for GatherUp.") {
        super(message);
        this.name = "AgeRestrictedException";
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
