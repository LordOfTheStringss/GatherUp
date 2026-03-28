export interface LocationData {
    id: string;
    label: string;
    latitude: number;
    longitude: number;
}

// Ankara bounding box for validating geocoded results
export const ANKARA_BOUNDS = {
    minLat: 39.72,
    maxLat: 40.10,
    minLng: 32.40,
    maxLng: 33.05,
};

export const isWithinAnkara = (lat: number, lng: number): boolean => {
    return (
        lat >= ANKARA_BOUNDS.minLat &&
        lat <= ANKARA_BOUNDS.maxLat &&
        lng >= ANKARA_BOUNDS.minLng &&
        lng <= ANKARA_BOUNDS.maxLng
    );
};

export const ANKARA_NEIGHBORHOODS: LocationData[] = [
    // Semtler / Districts
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
    { id: 'gop', label: 'Gaziosmanpaşa (GOP), Ankara', latitude: 39.8972, longitude: 32.8711 },
    { id: 'oran', label: 'Oran, Ankara', latitude: 39.8456, longitude: 32.8312 },
    { id: 'kecioren', label: 'Keçiören, Ankara', latitude: 39.9789, longitude: 32.8633 },
    { id: 'yenimahalle', label: 'Yenimahalle, Ankara', latitude: 39.9522, longitude: 32.8044 },
    { id: 'etlik', label: 'Etlik, Ankara', latitude: 39.9633, longitude: 32.8344 },
    { id: 'mamak', label: 'Mamak, Ankara', latitude: 39.9144, longitude: 32.9211 },
    { id: 'golbasi', label: 'Gölbaşı, Ankara', latitude: 39.7911, longitude: 32.8088 },
    { id: 'bilkent', label: 'Bilkent, Ankara', latitude: 39.8733, longitude: 32.7522 },
    { id: 'odtu', label: 'ODTÜ, Ankara', latitude: 39.8911, longitude: 32.7833 },
    { id: 'hacettepe', label: 'Hacettepe (Beytepe), Ankara', latitude: 39.8667, longitude: 32.7344 },
    { id: 'umitkoy', label: 'Ümitköy, Ankara', latitude: 39.8933, longitude: 32.7044 },
    { id: 'baglica', label: 'Bağlıca, Ankara', latitude: 39.8955, longitude: 32.6322 },
    { id: 'pursaklar', label: 'Pursaklar, Ankara', latitude: 40.0389, longitude: 32.9094 },
    { id: 'beysukent', label: 'Beysukent, Ankara', latitude: 39.8856, longitude: 32.7311 },
    { id: 'sincan', label: 'Sincan, Ankara', latitude: 39.9700, longitude: 32.5833 },
    { id: 'etimesgut', label: 'Etimesgut, Ankara', latitude: 39.9467, longitude: 32.6856 },
    { id: 'ovecler', label: 'Öveçler, Ankara', latitude: 39.8900, longitude: 32.8200 },
    { id: 'sogutozu', label: 'Söğütözü, Ankara', latitude: 39.9050, longitude: 32.8000 },
    { id: 'kizilay-meydani', label: 'Kızılay Meydanı', latitude: 39.9205, longitude: 32.8543 },
    { id: 'ulus', label: 'Ulus, Ankara', latitude: 39.9417, longitude: 32.8556 },
    { id: 'kolej', label: 'Kolej, Ankara', latitude: 39.9275, longitude: 32.8450 },
    { id: 'sihhiye', label: 'Sıhhiye, Ankara', latitude: 39.9275, longitude: 32.8525 },
    { id: 'maltepe', label: 'Maltepe, Ankara', latitude: 39.9350, longitude: 32.8400 },
    { id: 'tandogan', label: 'Tandoğan, Ankara', latitude: 39.9333, longitude: 32.8333 },
    { id: 'kurtulusparki', label: 'Kurtuluş Parkı', latitude: 39.9225, longitude: 32.8560 },
    { id: 'genclikparki', label: 'Gençlik Parkı', latitude: 39.9400, longitude: 32.8500 },
    { id: 'segmenler', label: 'Segmenler Parkı', latitude: 39.8975, longitude: 32.8490 },
    { id: 'anit-kabir', label: 'Anıtkabir', latitude: 39.9254, longitude: 32.8369 },
    { id: 'atakule', label: 'Atakule', latitude: 39.8871, longitude: 32.8567 },
    { id: 'armada', label: 'Armada AVM', latitude: 39.9040, longitude: 32.8100 },
    { id: 'kentpark', label: 'Kentpark AVM', latitude: 39.9425, longitude: 32.8108 },
    { id: 'ankamall', label: 'ANKAmall AVM', latitude: 39.9567, longitude: 32.8472 },
    { id: 'panora', label: 'Panora AVM, Oran', latitude: 39.8560, longitude: 32.8180 },
    { id: 'cepa', label: 'Cepa AVM', latitude: 39.9100, longitude: 32.8050 },
    { id: 'gordion', label: 'Gordion AVM', latitude: 39.8950, longitude: 32.8150 },

    // Caddeler / Streets
    { id: 'ataturk-bulvari', label: 'Atatürk Bulvarı', latitude: 39.9250, longitude: 32.8530 },
    { id: 'tunali-cad', label: 'Tunalı Hilmi Caddesi', latitude: 39.9060, longitude: 32.8600 },
    { id: 'bahcelievler-7cad', label: 'Bahçelievler 7. Cadde', latitude: 39.9200, longitude: 32.8220 },
    { id: 'cinnah-cad', label: 'Cinnah Caddesi', latitude: 39.8970, longitude: 32.8630 },
    { id: 'iran-cad', label: 'İran Caddesi', latitude: 39.9005, longitude: 32.8590 },
    { id: 'hosdere-cad', label: 'Hoşdere Caddesi', latitude: 39.8930, longitude: 32.8550 },
    { id: 'eskisehir-yolu', label: 'Eskişehir Yolu', latitude: 39.9050, longitude: 32.7800 },
    { id: 'konya-yolu', label: 'Konya Yolu', latitude: 39.8700, longitude: 32.8200 },
    { id: 'istiklal-cad', label: 'İstiklal Caddesi (Ulus)', latitude: 39.9420, longitude: 32.8550 },
    { id: 'necatibey-cad', label: 'Necatibey Caddesi', latitude: 39.9180, longitude: 32.8500 },
    { id: 'kazim-ozalp', label: 'Kazım Özalp Sokak', latitude: 39.9070, longitude: 32.8580 },

    // Üniversiteler / Universities
    { id: 'ankara-uni', label: 'Ankara Üniversitesi (Tandoğan)', latitude: 39.9375, longitude: 32.8361 },
    { id: 'gazi-uni', label: 'Gazi Üniversitesi (Maltepe)', latitude: 39.9411, longitude: 32.8100 },
    { id: 'baskent-uni', label: 'Başkent Üniversitesi (Bağlıca)', latitude: 39.8800, longitude: 32.6550 },
    { id: 'ted-uni', label: 'TED Üniversitesi', latitude: 39.9488, longitude: 32.8300 },
    { id: 'atilim-uni', label: 'Atılım Üniversitesi (İncek)', latitude: 39.8190, longitude: 32.7230 },
    { id: 'tobb-etu', label: 'TOBB ETÜ', latitude: 39.9228, longitude: 32.8030 },
    { id: 'cankaya-uni', label: 'Çankaya Üniversitesi', latitude: 39.7930, longitude: 32.8160 },
    { id: 'ybu', label: 'Yıldırım Beyazıt Üniversitesi', latitude: 39.9700, longitude: 32.8550 },
    { id: 'odtu-kampus', label: 'ODTÜ Kampüsü', latitude: 39.8911, longitude: 32.7833 },
    { id: 'hacettepe-kampus', label: 'Hacettepe Kampüsü', latitude: 39.8667, longitude: 32.7344 },
];

export const getLocationByLabel = (label: string): LocationData | undefined => {
    return ANKARA_NEIGHBORHOODS.find(loc => loc.label === label);
};

export const getLocationById = (id: string): LocationData | undefined => {
    return ANKARA_NEIGHBORHOODS.find(loc => loc.id === id);
};

export const searchLocations = (query: string): LocationData[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ANKARA_NEIGHBORHOODS.filter(loc =>
        loc.label.toLowerCase().includes(q) ||
        loc.id.toLowerCase().includes(q)
    );
};
