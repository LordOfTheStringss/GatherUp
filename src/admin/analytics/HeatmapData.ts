export interface WeightedPoint {
    latitude: number;
    longitude: number;
    intensity: number;
}

/**
 * A lightweight object used to transfer map visualization data to the frontend.
 * (DTO - Data Transfer Object)
 */
export class HeatmapData {
    public points: WeightedPoint[];
    public generatedAt: Date;

    constructor(points: WeightedPoint[], generatedAt: Date) {
        this.points = points;
        this.generatedAt = generatedAt;
    }
}
