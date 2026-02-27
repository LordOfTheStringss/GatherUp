import { StaleObjectStateException } from './Exceptions';

export enum TargetType {
    USER = 'USER',
    EVENT = 'EVENT',
    CHAT = 'CHAT'
}

export enum ReportStatus {
    PENDING = 'PENDING',
    RESOLVED = 'RESOLVED',
    REJECTED = 'REJECTED'
}

export interface Report {
    id: string; // UUID
    reporterId: string; // UUID
    description: string;
}

/**
 * Manages the lifecycle of user-submitted complaints, from creation to resolution.
 * Structurally matches the LLD specifications for the ticket entity acting as a manager.
 */
export class ReportManager {
    public reportId: string; // UUID
    public targetType: TargetType;
    public status: ReportStatus;
    public evidence: any; // JSON

    // To simulate optimistic locking for the StaleObjectStateException
    private version: number = 1;

    constructor(reportId: string, targetType: TargetType, evidence: any) {
        this.reportId = reportId;
        this.targetType = targetType;
        this.status = ReportStatus.PENDING;
        this.evidence = evidence;
    }

    /**
     * Allocates a specific report to a moderator to prevent overlapping work.
     */
    public assignToModerator(moderatorId: string): void {
        // Implementation: Assign ticket
    }

    /**
     * Returns a queue of unresolved issues, prioritized by severity (e.g., Harassment > Spam).
     * Note: Since the class itself holds instance variables per report, 
     * this might act as a static or repository-level method in practice, 
     * but we stick to the LLD class structure.
     */
    public getPendingReports(): Report[] {
        return [];
    }

    /**
     * Finalizes the ticket and triggers an automated notification to the reporting 
     * user regarding the outcome.
     */
    public closeReport(actionTaken: string): void {
        const currentDbVersion = 1; // Stub fetch DB version

        if (this.version !== currentDbVersion) {
            throw new StaleObjectStateException();
        }

        this.status = ReportStatus.RESOLVED;
        this.version++;
        // Trigger notification
    }
}
