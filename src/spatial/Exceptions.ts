export class InvalidCoordinatesException extends Error {
    constructor(message: string = "Coordinates out of bounds: Latitude must be between -90 and 90, Longitude between -180 and 180.") {
        super(message);
        this.name = "InvalidCoordinatesException";
    }
}

export class ExternalMapServiceException extends Error {
    constructor(message: string = "Map tile provider failed to load or API quota exceeded.") {
        super(message);
        this.name = "ExternalMapServiceException";
    }
}
