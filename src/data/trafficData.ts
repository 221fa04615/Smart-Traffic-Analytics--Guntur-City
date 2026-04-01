
export interface TrafficNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'junction' | 'station' | 'parking' | 'hospital';
}

export interface TrafficEdge {
  source: string;
  target: string;
  distance: number; // in km
  baseTime: number; // in minutes
  signals: number;
  geometry?: [number, number][]; // Optional road-following coordinates
}

export const GUNTUR_LOCATIONS: TrafficNode[] = [
  { id: 'LAK', name: 'Lakshmipuram', lat: 16.3067, lng: 80.4365, type: 'junction' },
  { id: 'NTR', name: 'NTR Bus Station', lat: 16.2955, lng: 80.4561, type: 'station' },
  { id: 'LOD', name: 'Lodge Center', lat: 16.31, lng: 80.44, type: 'junction' },
  { id: 'RLY', name: 'Railway Station', lat: 16.3008, lng: 80.4428, type: 'station' },
  { id: 'AMA', name: 'Amaravathi Road', lat: 16.315, lng: 80.425, type: 'junction' },
  { id: 'BRO', name: 'Brodipet', lat: 16.3035, lng: 80.434, type: 'junction' },
  { id: 'GOR', name: 'Gorentla', lat: 16.3412, lng: 80.4412, type: 'junction' },
  { id: 'PER', name: 'Perecharla', lat: 16.3194, lng: 80.3387, type: 'junction' },
  { id: 'CHU', name: 'Chuttugunta Centre', lat: 16.29, lng: 80.42, type: 'junction' },
  { id: 'SAN', name: 'Sangadi Gunta', lat: 16.32, lng: 80.45, type: 'junction' },
  { id: 'MOO', name: 'Mooduvantenalu Road', lat: 16.298, lng: 80.43, type: 'junction' },
  { id: 'MAN', name: 'Manipuram Flyover', lat: 16.312, lng: 80.428, type: 'junction' },
  { id: 'PAT', name: 'Pattabhipuram Flyover', lat: 16.305, lng: 80.445, type: 'junction' },
  { id: 'NAA', name: 'Naaz Centre', lat: 16.3026, lng: 80.4369, type: 'junction' },
  { id: 'OBS', name: 'Old Bus Stand', lat: 16.2972, lng: 80.4417, type: 'junction' },
  { id: 'ZIN', name: 'Zinna Tower', lat: 16.3104, lng: 80.4372, type: 'junction' },
  { id: 'KUG', name: 'Kugler Hospital', lat: 16.3002, lng: 80.4332, type: 'hospital' },
  { id: 'GUJ', name: 'Gujjanagundla', lat: 16.3069, lng: 80.4106, type: 'junction' },
];

export const TRAFFIC_EDGES: TrafficEdge[] = [
  { 
    source: 'LAK', target: 'BRO', distance: 1.2, baseTime: 4, signals: 2,
    geometry: [[16.3067, 80.4365], [16.3050, 80.4360], [16.3035, 80.434]]
  },
  { 
    source: 'BRO', target: 'NAA', distance: 0.8, baseTime: 3, signals: 1,
    geometry: [[16.3035, 80.434], [16.3030, 80.4355], [16.3026, 80.4369]]
  },
  { 
    source: 'NAA', target: 'LOD', distance: 1.5, baseTime: 5, signals: 3,
    geometry: [[16.3026, 80.4369], [16.3060, 80.4380], [16.31, 80.44]]
  },
  { 
    source: 'LOD', target: 'ZIN', distance: 0.5, baseTime: 2, signals: 1,
    geometry: [[16.31, 80.44], [16.3102, 80.4385], [16.3104, 80.4372]]
  },
  { 
    source: 'ZIN', target: 'LAK', distance: 0.7, baseTime: 2, signals: 1,
    geometry: [[16.3104, 80.4372], [16.3085, 80.4368], [16.3067, 80.4365]]
  },
  { 
    source: 'RLY', target: 'OBS', distance: 1.0, baseTime: 3, signals: 2,
    geometry: [[16.3008, 80.4428], [16.2990, 80.4420], [16.2972, 80.4417]]
  },
  { 
    source: 'OBS', target: 'NTR', distance: 1.8, baseTime: 6, signals: 4,
    geometry: [[16.2972, 80.4417], [16.2965, 80.4480], [16.2955, 80.4561]]
  },
  { 
    source: 'NTR', target: 'PAT', distance: 2.2, baseTime: 7, signals: 3,
    geometry: [[16.2955, 80.4561], [16.3000, 80.4500], [16.305, 80.445]]
  },
  { 
    source: 'PAT', target: 'LOD', distance: 1.1, baseTime: 4, signals: 2,
    geometry: [[16.305, 80.445], [16.3080, 80.4430], [16.31, 80.44]]
  },
  { 
    source: 'AMA', target: 'MAN', distance: 1.4, baseTime: 4, signals: 2,
    geometry: [[16.315, 80.425], [16.3135, 80.4265], [16.312, 80.428]]
  },
  { 
    source: 'MAN', target: 'BRO', distance: 1.6, baseTime: 5, signals: 2,
    geometry: [[16.312, 80.428], [16.3080, 80.4310], [16.3035, 80.434]]
  },
  { 
    source: 'CHU', target: 'MOO', distance: 1.3, baseTime: 4, signals: 1,
    geometry: [[16.29, 80.42], [16.2940, 80.4250], [16.298, 80.43]]
  },
  { 
    source: 'MOO', target: 'RLY', distance: 1.5, baseTime: 5, signals: 2,
    geometry: [[16.298, 80.43], [16.2995, 80.4360], [16.3008, 80.4428]]
  },
  { 
    source: 'KUG', target: 'MOO', distance: 0.6, baseTime: 2, signals: 1,
    geometry: [[16.3002, 80.4332], [16.2990, 80.4315], [16.298, 80.43]]
  },
  { 
    source: 'GOR', target: 'SAN', distance: 3.5, baseTime: 10, signals: 5,
    geometry: [[16.3412, 80.4412], [16.3300, 80.4450], [16.32, 80.45]]
  },
  { 
    source: 'SAN', target: 'LOD', distance: 2.0, baseTime: 6, signals: 3,
    geometry: [[16.32, 80.45], [16.3150, 80.4450], [16.31, 80.44]]
  },
  { 
    source: 'GUJ', target: 'AMA', distance: 1.8, baseTime: 5, signals: 2,
    geometry: [[16.3069, 80.4106], [16.3110, 80.4180], [16.315, 80.425]]
  },
  { 
    source: 'GUJ', target: 'CHU', distance: 2.5, baseTime: 8, signals: 3,
    geometry: [[16.3069, 80.4106], [16.2980, 80.4150], [16.29, 80.42]]
  },
  { 
    source: 'CHU', target: 'KUG', distance: 1.2, baseTime: 4, signals: 1,
    geometry: [[16.29, 80.42], [16.2950, 80.4280], [16.3002, 80.4332]]
  },
  { 
    source: 'LAK', target: 'ZIN', distance: 0.7, baseTime: 2, signals: 1,
    geometry: [[16.3067, 80.4365], [16.3085, 80.4368], [16.3104, 80.4372]]
  },
  { 
    source: 'BRO', target: 'LAK', distance: 1.2, baseTime: 4, signals: 2,
    geometry: [[16.3035, 80.434], [16.3050, 80.4360], [16.3067, 80.4365]]
  },
  { 
    source: 'NAA', target: 'RLY', distance: 0.9, baseTime: 3, signals: 1,
    geometry: [[16.3026, 80.4369], [16.3015, 80.4400], [16.3008, 80.4428]]
  },
  { 
    source: 'LOD', target: 'SAN', distance: 2.0, baseTime: 6, signals: 3,
    geometry: [[16.31, 80.44], [16.3150, 80.4450], [16.32, 80.45]]
  },
  { 
    source: 'SAN', target: 'GOR', distance: 3.5, baseTime: 10, signals: 5,
    geometry: [[16.32, 80.45], [16.3300, 80.4450], [16.3412, 80.4412]]
  },
  { 
    source: 'PAT', target: 'RLY', distance: 0.8, baseTime: 2, signals: 1,
    geometry: [[16.305, 80.445], [16.3030, 80.4440], [16.3008, 80.4428]]
  },
  { 
    source: 'MAN', target: 'LAK', distance: 1.1, baseTime: 3, signals: 1,
    geometry: [[16.312, 80.428], [16.3090, 80.4320], [16.3067, 80.4365]]
  },
  { 
    source: 'PER', target: 'GUJ', distance: 6.5, baseTime: 15, signals: 4,
    geometry: [[16.3194, 80.3387], [16.3130, 80.3750], [16.3069, 80.4106]]
  },
  { 
    source: 'PER', target: 'AMA', distance: 7.2, baseTime: 18, signals: 5,
    geometry: [[16.3194, 80.3387], [16.3170, 80.3800], [16.315, 80.425]]
  },
];

export const PARKING_AREAS = [
  { id: 'pkg-1', name: 'Brodipet Multi-level Parking', lat: 16.304, lng: 80.435, capacity: 200, occupied: 145 },
  { id: 'pkg-2', name: 'Railway Station East Gate', lat: 16.301, lng: 80.444, capacity: 150, occupied: 120 },
  { id: 'pkg-3', name: 'NTR Bus Station Parking', lat: 16.296, lng: 80.457, capacity: 300, occupied: 280 },
];

export const PUBLIC_TRANSPORT = [
  { name: 'City Bus Route 10A', status: 'On Time', nextStop: 'Lodge Center' },
  { name: 'City Bus Route 25', status: 'Delayed 5m', nextStop: 'Lakshmipuram' },
  { name: 'Auto Stand - Brodipet', status: 'Available', count: 12 },
];
