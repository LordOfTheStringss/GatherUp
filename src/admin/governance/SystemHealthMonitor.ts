import { QuotaServiceUnreachableException } from './Exceptions';

export enum ServiceStatus {
    ONLINE = 'ONLINE',
    OFFLINE = 'OFFLINE',
    DEGRADED = 'DEGRADED'
}

/**
 * Actively tracks the usage of third-party services to ensure the system
 * does not exceed the "Free Tier" limits (Zero-Budget constraint).
 */
export class SystemHealthMonitor {
    // Hard limits defined by service providers
    private apiQuotas: Map<string, number>;

    // Real-time usage counter for the current billing cycle
    private currentUsage: Map<string, number>;

    constructor() {
        this.apiQuotas = new Map<string, number>();
        this.apiQuotas.set("MAP_LOADS", 20000);
        this.apiQuotas.set("OCR_REQUESTS", 1000);

        this.currentUsage = new Map<string, number>();
        this.currentUsage.set("MAP_LOADS", 0);
        this.currentUsage.set("OCR_REQUESTS", 0);
    }

    /**
     * Pings external services to verify uptime and connectivity.
     */
    public checkServiceStatus(): ServiceStatus {
        const isReachable = true; // Stub

        if (!isReachable) {
            // Forces graceful degradation by serving cached metrics
            throw new QuotaServiceUnreachableException();
        }
        return ServiceStatus.ONLINE;
    }

    /**
     * Logic that triggers a notification to Administrator when service hits
     * a critical threshold (e.g. 80% of quota).
     */
    public triggerAlert(serviceName: string): void {
        const quota = this.apiQuotas.get(serviceName) || 0;
        const usage = this.currentUsage.get(serviceName) || 0;

        if (quota > 0 && usage / quota >= 0.8) {
            // Trigger admin notification workflow
            console.warn(`[ALERT] Service ${serviceName} has reached 80% of its quota!`);
        }
    }
}
