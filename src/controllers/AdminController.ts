import { DomainWhitelister } from '../admin/governance/DomainWhitelister';
import { ServiceStatus, SystemHealthMonitor } from '../admin/governance/SystemHealthMonitor';
import { Moderator } from '../admin/moderation/Moderator';
import { Report, ReportManager } from '../admin/moderation/ReportManager';
import { ResponseEntity } from './ResponseEntity';

export enum Action {
    BAN = 'BAN',
    IGNORE = 'IGNORE',
    WARN = 'WARN'
}

/**
 * Provides moderation and system monitoring.
 */
export class AdminController {
    // Attributes
    private moderatorService: Moderator;
    private reportManager: ReportManager;
    private healthMonitor: SystemHealthMonitor;
    private domainWhitelister: DomainWhitelister;

    constructor(
        moderatorService: Moderator,
        reportManager: ReportManager,
        healthMonitor: SystemHealthMonitor,
        domainWhitelister: DomainWhitelister
    ) {
        this.moderatorService = moderatorService;
        this.reportManager = reportManager;
        this.healthMonitor = healthMonitor;
        this.domainWhitelister = domainWhitelister;
    }

    /**
     * Lists unresolved reports.
     */
    public async getPendingReports(): Promise<ResponseEntity<Report[]>> {
        return { status: 200, data: [] };
    }

    /**
     * Closes report (ban or ignore).
     */
    public async resolveReport(reportId: string, action: Action): Promise<ResponseEntity> {
        return { status: 200, message: `Report ${action}` };
    }

    /**
     * Adds new institutional domain.
     */
    public async addWhitelistedDomain(domain: string): Promise<ResponseEntity> {
        this.domainWhitelister.addDomain(domain);
        return { status: 201, message: "Domain Whitelisted" };
    }

    /**
     * Call healthMonitor.checkServiceStatus().
     */
    public async getSystemStatus(): Promise<ResponseEntity<Map<string, ServiceStatus>>> {
        return { status: 200, data: new Map() };
    }
}
