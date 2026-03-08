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
    { id: 'balgat', label: 'Balgat, Ankara', latitude: 39.9044, longitude: 32.8244 },
    { id: 'incek', label: 'İncek, Ankara', latitude: 39.8254, longitude: 32.7156 },
    { id: 'yasamkent', label: 'Yaşamkent, Ankara', latitude: 39.8654, longitude: 32.6512 },
    { id: 'emek', label: 'Emek, Ankara', latitude: 39.9234, longitude: 32.8288 },
    { id: 'ayranci', label: 'Ayrancı, Ankara', latitude: 39.9012, longitude: 32.8522 },
    { id: 'gop', label: 'Gaziosmanpaşa, Ankara', latitude: 39.8972, longitude: 32.8711 },
    { id: 'oran', label: 'Oran, Ankara', latitude: 39.8456, longitude: 32.8312 },
    { id: 'kecioren', label: 'Keçiören, Ankara', latitude: 39.9789, longitude: 32.8633 },
    { id: 'yenimahalle', label: 'Yenimahalle, Ankara', latitude: 39.9522, longitude: 32.8044 },
    { id: 'etlik', label: 'Etlik, Ankara', latitude: 39.9633, longitude: 32.8344 },
    { id: 'mamak', label: 'Mamak, Ankara', latitude: 39.9144, longitude: 32.9211 },
    { id: 'golbasi', label: 'Gölbaşı, Ankara', latitude: 39.7911, longitude: 32.8088 },
    { id: 'bilkent', label: 'Bilkent, Ankara', latitude: 39.8733, longitude: 32.7522 },
    { id: 'odtü', label: 'ODTÜ, Ankara', latitude: 39.8911, longitude: 32.7833 },
    { id: 'hacettepe', label: 'Hacettepe (Beytepe), Ankara', latitude: 39.8667, longitude: 32.7344 },
    { id: 'umitkoy', label: 'Ümitköy, Ankara', latitude: 39.8933, longitude: 32.7044 },
    { id: 'baglica', label: 'Bağlıca, Ankara', latitude: 39.8955, longitude: 32.6322 },
];

export const getLocationByLabel = (label: string): LocationData | undefined => {
    return ANKARA_NEIGHBORHOODS.find(loc => loc.label === label);
};
