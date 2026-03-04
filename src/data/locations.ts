export interface LocationData {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
}

export const ANKARA_NEIGHBORHOODS: LocationData[] = [
    { id: 'besevler', label: 'Beşevler, Ankara', latitude: 39.9366, longitude: 32.8256 },
    { id: 'bahcelievler', label: 'Bahçelievler, Ankara', latitude: 39.9168, longitude: 32.8210 },
    { id: 'kizilay', label: 'Kızılay, Ankara', latitude: 39.9208, longitude: 32.8541 },
    { id: 'tunali', label: 'Tunalı Hilmi, Ankara', latitude: 39.9054, longitude: 32.8601 },
    { id: 'cankaya', label: 'Çankaya (Merkez), Ankara', latitude: 39.8833, longitude: 32.8667 },
    { id: 'cukurambar', label: 'Çukurambar, Ankara', latitude: 39.9022, longitude: 32.8093 },
    { id: 'cayyolu', label: 'Çayyolu, Ankara', latitude: 39.8838, longitude: 32.6975 },
    { id: 'batikent', label: 'Batıkent, Ankara', latitude: 39.9691, longitude: 32.7480 },
    { id: 'eryaman', label: 'Eryaman, Ankara', latitude: 39.9667, longitude: 32.6289 },
    { id: 'dikmen', label: 'Dikmen, Ankara', latitude: 39.8817, longitude: 32.8361 },
];

export const getLocationByLabel = (label: string): LocationData | undefined => {
    return ANKARA_NEIGHBORHOODS.find(loc => loc.label === label);
};
