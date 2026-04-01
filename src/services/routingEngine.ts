
import { TRAFFIC_EDGES, TrafficEdge, GUNTUR_LOCATIONS } from '../data/trafficData';

export interface RouteResult {
  id: string;
  type: 'fastest' | 'shortest' | 'alternate';
  path: string[];
  fullPath: [number, number][]; // Detailed road-following coordinates
  totalDistance: number;
  estimatedTime: number;
  signalCount: number;
  signalDelay: number;
  congestionLevel: number;
  signalLocations: [number, number][];
}

export async function calculateMultipleRoutes(
  startNodeId: string,
  endNodeId: string,
  trafficData: any[],
  isEmergency: boolean = false,
  predictions: any[] = []
): Promise<RouteResult[]> {
  const routes: RouteResult[] = [];
  
  // 1. Fastest
  const fastest = await calculateRoute(startNodeId, endNodeId, trafficData, isEmergency, 'fastest', [], predictions);
  if (fastest) {
    fastest.type = 'fastest';
    routes.push(fastest);
  }

  // 2. Shortest
  const shortest = await calculateRoute(startNodeId, endNodeId, trafficData, isEmergency, 'shortest', [], predictions);
  if (shortest && (!fastest || shortest.path.join(',') !== fastest.path.join(','))) {
    shortest.type = 'shortest';
    routes.push(shortest);
  }

  // 3. Alternate (by penalizing edges of the fastest route)
  if (fastest) {
    const alternate = await calculateRoute(startNodeId, endNodeId, trafficData, isEmergency, 'fastest', fastest.path, predictions);
    if (alternate && !routes.some(r => r.path.join(',') === alternate.path.join(','))) {
      alternate.type = 'alternate';
      routes.push(alternate);
    }
  }

  return routes;
}

export async function calculateRoute(
  startNodeId: string,
  endNodeId: string,
  trafficData: any[],
  isEmergency: boolean = false,
  mode: 'fastest' | 'shortest' = 'fastest',
  penalizedPath: string[] = [],
  predictions: any[] = []
): Promise<RouteResult | null> {
  const nodes = new Set<string>();
  TRAFFIC_EDGES.forEach(edge => {
    nodes.add(edge.source);
    nodes.add(edge.target);
  });

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const queue = new Set<string>();

  nodes.forEach(node => {
    distances[node] = Infinity;
    previous[node] = null;
    queue.add(node);
  });

  distances[startNodeId] = 0;

  while (queue.size > 0) {
    let u = Array.from(queue).reduce((minNode, node) => 
      distances[node] < distances[minNode] ? node : minNode
    );

    if (u === endNodeId || distances[u] === Infinity) break;
    queue.delete(u);

    const neighbors = TRAFFIC_EDGES.filter(e => e.source === u || e.target === u);
    
    for (const edge of neighbors) {
      const v = edge.source === u ? edge.target : edge.source;
      if (!queue.has(v)) continue;

      const segmentTraffic = trafficData.find(t => t.id === u);
      const segmentPrediction = predictions.find(p => p.locationId === u);
      
      let congestion = segmentTraffic ? segmentTraffic.congestion : 20;
      if (segmentPrediction) {
        // Blend current congestion with predicted congestion (weighted towards prediction for future-looking routing)
        congestion = (congestion * 0.4) + (segmentPrediction.predictedCongestion * 0.6);
      }
      
      const congestionFactor = congestion / 50;
      
      let weight = edge.distance;
      if (mode === 'fastest') {
        const signalDelay = isEmergency ? 0.1 : 0.8;
        // Use a more aggressive time-based weight for fastest
        weight = (edge.baseTime * (1 + congestionFactor * 2)) + (edge.signals * signalDelay);
      } else if (mode === 'shortest') {
        // Strictly distance for shortest
        weight = edge.distance;
      }

      // Penalize edges that are in the penalizedPath to find alternatives
      if (penalizedPath.length > 0) {
        const isPenalized = penalizedPath.some((node, idx) => 
          (node === u && penalizedPath[idx + 1] === v) || (node === v && penalizedPath[idx + 1] === u)
        );
        if (isPenalized) {
          weight *= 5; // Heavily penalize to force a different path
        }
      }
      
      const alt = distances[u] + weight;
      if (alt < distances[v]) {
        distances[v] = alt;
        previous[v] = u;
      }
    }
  }

  const path: string[] = [];
  let curr: string | null = endNodeId;
  while (curr) {
    path.unshift(curr);
    curr = previous[curr];
  }

  if (path[0] !== startNodeId) return null;

  let totalDistance = 0;
  let estimatedTime = 0;
  let signalCount = 0;
  let totalCongestion = 0;
  let totalSignalDelay = 0;
  let fullPath: [number, number][] = [];

  // Calculate metrics based on graph edges
  for (let i = 0; i < path.length - 1; i++) {
    const edge = TRAFFIC_EDGES.find(e => 
      (e.source === path[i] && e.target === path[i+1]) || 
      (e.target === path[i] && e.source === path[i+1])
    );
    if (edge) {
      const segmentTraffic = trafficData.find(t => t.id === edge.source);
      const segmentPrediction = predictions.find(p => p.locationId === edge.source);
      
      let cong = segmentTraffic ? segmentTraffic.congestion : 20;
      if (segmentPrediction) {
        cong = (cong * 0.4) + (segmentPrediction.predictedCongestion * 0.6);
      }
      
      totalDistance += edge.distance;
      signalCount += edge.signals;
      totalCongestion += cong;
      
      const signalDelay = isEmergency ? 0.1 : 0.6;
      const segmentSignalDelay = edge.signals * signalDelay;
      totalSignalDelay += segmentSignalDelay;
      estimatedTime += (edge.baseTime * (1 + (cong/100))) + segmentSignalDelay;
    }
  }

  // Fetch real road geometry from OSRM
  try {
    const waypoints = path.map(id => {
      const node = GUNTUR_LOCATIONS.find(n => n.id === id);
      if (!node) return null;
      return `${node.lng},${node.lat}`;
    }).filter(Boolean).join(';');
    
    if (!waypoints) throw new Error("Invalid waypoints");
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      fullPath = data.routes[0].geometry.coordinates.map((coord: any) => [coord[1], coord[0]]);
      // Use real distance from OSRM if available
      totalDistance = data.routes[0].distance / 1000;
    } else {
      throw new Error("No route found in OSRM");
    }
  } catch (err) {
    console.warn("OSRM failed, falling back to straight lines:", err);
    fullPath = path.map(id => {
      const node = GUNTUR_LOCATIONS.find(n => n.id === id);
      return [node?.lat || 0, node?.lng || 0] as [number, number];
    });
  }

  // Calculate signal locations along the fullPath
  const signalLocations: [number, number][] = [];
  if (fullPath.length > 0) {
    const nodeIndices: number[] = [];
    path.forEach(nodeId => {
      const node = GUNTUR_LOCATIONS.find(n => n.id === nodeId);
      if (node) {
        let minIdx = 0;
        let minDistance = Infinity;
        fullPath.forEach((coord, idx) => {
          const d = Math.sqrt(Math.pow(coord[0] - node.lat, 2) + Math.pow(coord[1] - node.lng, 2));
          if (d < minDistance) {
            minDistance = d;
            minIdx = idx;
          }
        });
        nodeIndices.push(minIdx);
      }
    });

    for (let i = 0; i < path.length - 1; i++) {
      const edge = TRAFFIC_EDGES.find(e => 
        (e.source === path[i] && e.target === path[i+1]) || 
        (e.target === path[i] && e.source === path[i+1])
      );
      if (edge && edge.signals > 0) {
        const startIdx = nodeIndices[i];
        const endIdx = nodeIndices[i+1];
        const segment = fullPath.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
        
        if (segment.length >= 2) {
          for (let s = 1; s <= edge.signals; s++) {
            const fraction = s / (edge.signals + 1);
            const targetIdx = Math.floor(fraction * (segment.length - 1));
            signalLocations.push(segment[targetIdx]);
          }
        }
      }
    }
  }

  return {
    id: `${mode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random() * 1000000)}`,
    type: mode,
    path,
    fullPath,
    totalDistance: parseFloat(totalDistance.toFixed(2)),
    estimatedTime: Math.round(estimatedTime),
    signalCount,
    signalDelay: Math.round(totalSignalDelay),
    congestionLevel: path.length > 1 ? Math.round(totalCongestion / (path.length - 1)) : 0,
    signalLocations
  };
}
