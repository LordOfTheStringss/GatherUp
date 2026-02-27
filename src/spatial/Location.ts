import { InvalidCoordinatesException } from './Exceptions';

export interface GeoPoint {
    latitude: number;
    longitude: number;
}

export enum LocationType {
    CAFE = 'CAFE',
    PARK = 'PARK',
    CAMPUS = 'CAMPUS',
    LIBRARY = 'LIBRARY',
    SPORTS_HALL = 'SPORTS_HALL'
}

/**
 * Encapsulates physical location data and provides geometric utility methods.
 */
export class Location {
    public locationId: string; // UUID
    public name: string;
    public coordinates: GeoPoint;
    public type: LocationType;

    constructor(locationId: string, name: string, coordinates: GeoPoint, type: LocationType) {
        if (coordinates.latitude < -90 || coordinates.latitude > 90 ||
            coordinates.longitude < -180 || coordinates.longitude > 180) {
            throw new InvalidCoordinatesException();
        }

        this.locationId = locationId;
        this.name = name;
        this.coordinates = coordinates;
        this.type = type;
    }

    /**
     * Calculates the great-circle distance (Haversine formula) in meters 
     * between this location and another point.
     */
    public distanceTo(other: GeoPoint): number {
        const R = 6371e3; // Earth's radius in meters
        const lat1 = this.coordinates.latitude * Math.PI / 180;
        const lat2 = other.latitude * Math.PI / 180;
        const deltaLat = (other.latitude - this.coordinates.latitude) * Math.PI / 180;
        const deltaLon = (other.longitude - this.coordinates.longitude) * Math.PI / 180;

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Returns distance in meters
    }
}
