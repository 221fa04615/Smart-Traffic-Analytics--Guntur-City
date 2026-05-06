
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { 
  Activity, 
  Navigation, 
  AlertTriangle, 
  Clock, 
  Map as MapIcon, 
  Car, 
  Bus, 
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  Signal,
  ArrowRight,
  Info,
  ParkingCircle,
  MapPin,
  User,
  LogOut,
  Zap,
  ZapOff,
  ShieldCheck,
  Flame,
  HelpCircle,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Mic,
  MicOff,
  Leaf,
  MessageSquare,
  Camera,
  Sparkles,
  Volume2,
  CloudSun,
  Wind,
  Layers,
  Eye,
  EyeOff,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Columns,
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GUNTUR_LOCATIONS, TRAFFIC_EDGES, PARKING_AREAS, PUBLIC_TRANSPORT } from './data/trafficData';
import { calculateRoute, calculateMultipleRoutes, RouteResult } from './services/routingEngine';
import { 
  getTrafficForecast, 
  TrafficPrediction, 
  getPublicTransportInfo, 
  PublicTransportInfo,
  getDailyBriefing,
  processVoiceCommand,
  analyzeIncident,
  IncidentAnalysis,
  getCityPulse,
  CityPulseEvent,
  getParkingPrediction,
  ParkingPrediction,
  getEcoFriendlyAdvice,
  getRouteAdvice,
  RouteAdvice
} from './services/trafficAI';

interface SavedRoute {
  id: string;
  name: string;
  start: string;
  end: string;
  timestamp: string;
  details: RouteResult;
}

interface UserData {
  email: string;
  name: string;
  savedRoutes?: SavedRoute[];
}

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  time: string;
}

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const HeatmapLayer = ({ points }: { points: [number, number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (!(L as any).heatLayer) {
      console.warn('Leaflet Heat plugin not loaded');
      return;
    }
    
    if (points.length === 0) return;
    
    let heat: any = null;
    let rafId: number;

    const initHeatLayer = () => {
      const size = map.getSize();
      const container = map.getContainer();
      
      // Ensure map has valid dimensions and is visible
      if (size.x > 10 && size.y > 10 && container.clientWidth > 0 && container.clientHeight > 0) {
        try {
          if (heat) {
            map.removeLayer(heat);
          }
          heat = (L as any).heatLayer(points, { radius: 25, blur: 15, max: 1.0 }).addTo(map);
        } catch (err) {
          console.error("Heatmap layer initialization failed:", err);
          rafId = requestAnimationFrame(initHeatLayer);
        }
      } else {
        rafId = requestAnimationFrame(initHeatLayer);
      }
    };

    rafId = requestAnimationFrame(initHeatLayer);

    return () => { 
      cancelAnimationFrame(rafId);
      if (map && heat) {
        try {
          map.removeLayer(heat); 
        } catch (e) {
          // Ignore removal errors on unmount
        }
      }
    };
  }, [map, points]);
  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'explore' | 'navigate' | 'predict' | 'pulse' | 'performance'>('explore');
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<RouteResult[]>([]);
  const [routeAdvice, setRouteAdvice] = useState<RouteAdvice | null>(null);
  const [isFindingAlternatives, setIsFindingAlternatives] = useState(false);
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [routeStart, setRouteStart] = useState('');
  const [routeEnd, setRouteEnd] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [predictions, setPredictions] = useState<TrafficPrediction[]>([]);
  const [selectedTimeHorizon, setSelectedTimeHorizon] = useState<number>(20);
  const [isPredicting, setIsPredicting] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationStatus, setOptimizationStatus] = useState<string | null>(null);
  const [validatedPredictions, setValidatedPredictions] = useState<Set<string>>(new Set());

  const handleValidate = (id: string) => {
    setValidatedPredictions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auth State
  const [user, setUser] = useState<UserData | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [authError, setAuthError] = useState('');

  // Public Transport State
  const [publicTransport, setPublicTransport] = useState<PublicTransportInfo[]>([]);
  const [isLoadingTransport, setIsLoadingTransport] = useState(false);

  // Map Settings State
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Comparison Modal State
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Advanced AI State
  const [dailyBriefing, setDailyBriefing] = useState<string | null>(null);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ description: '', image: '' as string | null });
  const [isAnalyzingIncident, setIsAnalyzingIncident] = useState(false);
  const [incidentAnalysis, setIncidentAnalysis] = useState<IncidentAnalysis | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [cityPulse, setCityPulse] = useState<CityPulseEvent[]>([]);
  const [isPulseLoading, setIsPulseLoading] = useState(false);
  const [parkingPrediction, setParkingPrediction] = useState<ParkingPrediction | null>(null);
  const [isParkingLoading, setIsParkingLoading] = useState(false);
  const [ecoAdvice, setEcoAdvice] = useState<string | null>(null);
  const [isAiOffline, setIsAiOffline] = useState(false);
  const [isEcoLoading, setIsEcoLoading] = useState(false);
  const [showTrafficEdges, setShowTrafficEdges] = useState(true);
  const [showVoiceGuide, setShowVoiceGuide] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Mock real-time data
  const trafficData = useMemo(() => GUNTUR_LOCATIONS.map(loc => ({
    ...loc,
    speed: 15 + Math.random() * 25,
    congestion: Math.random() * 80
  })), []);

  const trafficEdgesData = useMemo(() => TRAFFIC_EDGES.map((edge, idx) => ({
    ...edge,
    id: `edge-${idx}`,
    speed: 10 + Math.random() * 40,
    congestion: Math.random() * 90
  })), []);

  // Clear routes when source or destination changes
  useEffect(() => {
    setRoutes([]);
    setSelectedRouteId(null);
  }, [routeStart, routeEnd]);

  // Fetch Daily Briefing
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsBriefingLoading(true);
      try {
        const briefing = await getDailyBriefing(trafficData);
        setDailyBriefing(briefing);
      } catch (err) {
        console.error("Briefing fetch failed:", err);
      } finally {
        setIsBriefingLoading(false);
      }
    }, 500); // 500ms delay
    return () => clearTimeout(timer);
  }, [trafficData]);

  // Fetch City Pulse
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsPulseLoading(true);
      try {
        const pulse = await getCityPulse();
        setCityPulse(pulse);
      } catch (err) {
        console.error("City Pulse fetch failed:", err);
      } finally {
        setIsPulseLoading(false);
      }
    }, 1500); // 1.5s delay to stagger
    return () => clearTimeout(timer);
  }, []);

  // Fetch Parking Prediction when destination changes
  useEffect(() => {
    if (routeEnd) {
      const fetchParking = async () => {
        setIsParkingLoading(true);
        const dest = GUNTUR_LOCATIONS.find(l => l.id === routeEnd);
        if (dest) {
          try {
            const prediction = await getParkingPrediction(dest.name);
            setParkingPrediction(prediction);
          } catch (err) {
            console.error("Parking prediction failed:", err);
          } finally {
            setIsParkingLoading(false);
          }
        }
      };
      fetchParking();
    } else {
      setParkingPrediction(null);
    }
  }, [routeEnd]);

  // Fetch Eco Advice when route is selected
  useEffect(() => {
    if (selectedRouteId && routes.length > 0) {
      const route = routes.find(r => r.id === selectedRouteId);
      if (route) {
        const fetchEco = async () => {
          setIsEcoLoading(true);
          try {
            const advice = await getEcoFriendlyAdvice(route);
            setEcoAdvice(advice);
          } catch (err) {
            console.error("Eco advice failed:", err);
          } finally {
            setIsEcoLoading(false);
          }
        };
        fetchEco();
      }
    } else {
      setEcoAdvice(null);
    }
  }, [selectedRouteId, routes]);

  // Proactive Rerouting Logic
  useEffect(() => {
    if (selectedRouteId && routes.length > 0) {
      const interval = setInterval(async () => {
        const currentRoute = routes.find(r => r.id === selectedRouteId);
        if (currentRoute && routeStart && routeEnd) {
          // Re-calculate to see if there's a better one using latest predictions
          const fastest = await calculateRoute(routeStart, routeEnd, trafficData, isEmergency, 'fastest', [], predictions);
          
          if (fastest && fastest.estimatedTime < currentRoute.estimatedTime - 2) { // At least 2 mins faster
            setNotifications(prev => [{
              id: `reroute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              message: `AI detected a faster route! Save ${Math.round(currentRoute.estimatedTime - fastest.estimatedTime)} minutes by switching.`,
              type: 'info',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }, ...prev]);
          }
        }
      }, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [selectedRouteId, routes, routeStart, routeEnd, isEmergency, trafficData]);

  // Voice Assistant Logic
  const startVoiceAssistant = () => {
    if (isVoiceActive && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsVoiceActive(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotifications(prev => [{
        id: `voice_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
        type: 'warning',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, ...prev]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsVoiceActive(true);
      setVoiceTranscript('Listening...');
      setVoiceResponse(null);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript(transcript);
      
      try {
        const result = await processVoiceCommand(transcript);
        setVoiceResponse(result.response);
        
        // Execute actions based on AI response
        if (result.action === 'navigate' && result.params.destination) {
          const dest = GUNTUR_LOCATIONS.find(l => 
            l.name.toLowerCase().includes(result.params.destination!.toLowerCase())
          );
          if (dest) {
            setRouteEnd(dest.id);
            setActiveTab('navigate');
            // Ensure state is ready and search is triggered
            setTimeout(() => {
              if (!routeStart) setRouteStart('AMA'); // Default to Amaravathi Road if no start set
              handleRouteSearch('fastest');
            }, 500);
          }
        } else if (result.action === 'query_traffic' && result.params.location) {
          setActiveTab('explore');
        } else if (result.action === 'report_incident') {
          setShowIncidentModal(true);
        }

        // Text-to-Speech response
        const utterance = new SpeechSynthesisUtterance(result.response);
        window.speechSynthesis.speak(utterance);

      } catch (err) {
        console.error("Voice command processing failed:", err);
      } finally {
        setTimeout(() => setIsVoiceActive(false), 5000);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsVoiceActive(false);
      if (event.error === 'not-allowed') {
        setNotifications(prev => [{
          id: `voice_perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: "Microphone access denied. Please enable it in browser settings.",
          type: 'warning',
          time: new Date().toLocaleTimeString()
        }, ...prev]);
      }
    };

    recognition.onend = () => {
      // Only set inactive if we didn't get a result or it timed out
    };

    recognition.start();
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzingIncident(true);
    try {
      const analysis = await analyzeIncident(incidentForm.description, incidentForm.image || undefined);
      setIncidentAnalysis(analysis);
      
      setNotifications(prev => [{
        id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: `AI analyzed ${analysis.type}: ${analysis.suggestedAction}`,
        type: 'success',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, ...prev]);

      // In a real app, we would add this to the map/data
    } catch (err) {
      console.error("Incident analysis failed:", err);
    } finally {
      setIsAnalyzingIncident(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIncidentForm(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Check for existing user
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Fetch Public Transport Info
  useEffect(() => {
    const fetchTransport = async () => {
      setIsLoadingTransport(true);
      try {
        const info = await getPublicTransportInfo("Guntur Main");
        setPublicTransport(info);
      } catch (err) {
        console.error("Transport fetch failed:", err);
      } finally {
        setIsLoadingTransport(false);
      }
    };
    fetchTransport();
  }, []);

  // Real-time Update Simulation
  useEffect(() => {
    const fetchInitialPredictions = async () => {
      try {
        const res = await getTrafficForecast([...trafficData, ...trafficEdgesData], 20);
        setPredictions(res);
      } catch (err) {
        console.error("Failed to fetch initial predictions:", err);
      }
    };
    fetchInitialPredictions();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const updates = [
        "Congestion detected near Guntur Junction",
        "New city bus route added for Brodipet",
        "Traffic signal maintenance at Lodge Centre",
        "Local transport update: Route 10A frequency increased"
      ];
      const randomUpdate = updates[Math.floor(Math.random() * updates.length)];
      const newNotif: Notification = {
        id: `realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random() * 1000)}`,
        message: randomUpdate,
        type: Math.random() > 0.7 ? 'warning' : 'info',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setNotifications(prev => [newNotif, ...prev].slice(0, 5));
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setShowAuthModal(false);
      } else {
        setAuthError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Network error. Please try again.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const heatmapPoints: [number, number, number][] = useMemo(() => 
    trafficData.map(d => [d.lat, d.lng, d.congestion / 100]), 
  [trafficData]);

  const handleRouteSearch = async (mode: 'fastest' | 'shortest' | 'alternate' = 'fastest') => {
    if (!routeStart || !routeEnd) return;
    
    try {
      setRouteAdvice(null);
      
      // Fetch AI predictions first to inform routing
      setIsAdviceLoading(true);
      const trafficPredictions = await getTrafficForecast([...trafficData, ...trafficEdgesData], selectedTimeHorizon);
      setPredictions(trafficPredictions);

      if (mode === 'alternate') {
        setIsFindingAlternatives(true);
        const alts = await calculateMultipleRoutes(routeStart, routeEnd, trafficData, isEmergency, trafficPredictions);
        setAlternativeRoutes(alts);
        
        if (alts.length > 0) {
          let advice: RouteAdvice | null = null;
          try {
            advice = await getRouteAdvice(alts, trafficPredictions);
            setRouteAdvice(advice);
          } catch (err) {
            console.error("Failed to get route advice:", err);
          } finally {
            setIsAdviceLoading(false);
          }
          
          // Add all alternatives to the main routes list for display
          setRoutes(prev => {
            const altTypes = alts.map(r => r.type);
            const altIds = alts.map(r => r.id);
            // Filter out existing routes of the same types OR same IDs
            const filtered = prev.filter(r => !altTypes.includes(r.type as any) && !altIds.includes(r.id));
            return [...filtered, ...alts];
          });
          
          // Select the recommended one or the first one
          setSelectedRouteId(advice?.recommendedRouteId || alts[0].id);
        }
        setIsFindingAlternatives(false);
      } else {
        const result = await calculateRoute(routeStart, routeEnd, trafficData, isEmergency, mode, [], trafficPredictions);
        if (result) {
          const newRoute = { ...result, type: mode };
          setRoutes(prev => {
            const filtered = prev.filter(r => r.type !== mode && r.id !== result.id);
            return [...filtered, newRoute];
          });
          setSelectedRouteId(newRoute.id);
          
          // Also get advice for the single route if it's the only one
          try {
            const advice = await getRouteAdvice([newRoute], trafficPredictions);
            setRouteAdvice(advice);
          } catch (err) {
            console.error("Failed to get route advice:", err);
          } finally {
            setIsAdviceLoading(false);
          }
        }
      }
    } catch (err) {
      console.error("Route calculation failed:", err);
      setIsFindingAlternatives(false);
      setIsAdviceLoading(false);
      setNotifications(prev => [
        {
          id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: "Failed to calculate route. Please try a different destination.",
          type: 'warning',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);
    }
  };

  useEffect(() => {
    if (routeStart && routeEnd && routes.length > 0) {
      handleRouteSearch('fastest');
    }
  }, [isEmergency]);

  const handleOptimize = () => {
    setIsOptimizing(true);
    setOptimizationStatus("Initializing MARL Agents...");
    
    setTimeout(() => setOptimizationStatus("Synchronizing Signal Phases..."), 1000);
    setTimeout(() => setOptimizationStatus("Optimizing Flow Patterns..."), 2000);
    setTimeout(() => {
      setIsOptimizing(false);
      setOptimizationStatus("Optimization Complete: Flow improved by 24%");
      setTimeout(() => setOptimizationStatus(null), 3000);
    }, 3500);
  };

  const handleReport = (type: 'accident' | 'hazard') => {
    setNotifications(prev => [
      {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: `Reported ${type} at current location. Emergency services notified.`,
        type: 'success',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
  };

  const handleSaveRoute = (route: RouteResult) => {
    if (!user) {
      setShowAuthModal(true);
      setNotifications(prev => [
        {
          id: `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: "Please sign in to save routes.",
          type: 'info',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);
      return;
    }

    const isAlreadySaved = user.savedRoutes?.some(r => r.start === routeStart && r.end === routeEnd);
    if (isAlreadySaved) {
      setNotifications(prev => [
        {
          id: `exists_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: "This route is already in your saved list.",
          type: 'info',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        ...prev
      ]);
      return;
    }

    const newSavedRoute: SavedRoute = {
      id: `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${GUNTUR_LOCATIONS.find(l => l.id === routeStart)?.name} to ${GUNTUR_LOCATIONS.find(l => l.id === routeEnd)?.name}`,
      start: routeStart,
      end: routeEnd,
      timestamp: new Date().toISOString(),
      details: route
    };

    const updatedUser = {
      ...user,
      savedRoutes: [...(user.savedRoutes || []), newSavedRoute]
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    setNotifications(prev => [
      {
        id: `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: "Route saved to your profile.",
        type: 'success',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
  };

  const handleDeleteSavedRoute = (id: string) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      savedRoutes: user.savedRoutes?.filter(r => r.id !== id) || []
    };

    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    
    setNotifications(prev => [
      {
        id: `delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        message: "Route removed from saved list.",
        type: 'info',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
  };

  const handleLoadSavedRoute = (saved: SavedRoute) => {
    setRouteStart(saved.start);
    setRouteEnd(saved.end);
    setRoutes([saved.details]);
    setSelectedRouteId(saved.details.id);
  };

  const selectedRoute = useMemo(() => 
    routes.find(r => r.id === selectedRouteId), 
  [routes, selectedRouteId]);

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans bg-zinc-950 text-zinc-50">
      {/* Sidebar */}
      <div className="w-[420px] bg-zinc-900 border-r border-zinc-800 flex flex-col z-20 shadow-2xl overflow-hidden">
        {/* User Profile */}
        <div className="p-6 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden ring-2 ring-blue-500/20">
              {user ? (
                <span className="text-lg font-bold">{user.name[0]}</span>
              ) : (
                <User className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-zinc-100">
                {user ? user.name : 'Guest User'}
              </h2>
              {!user && (
                <button 
                  onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                  className="text-[10px] text-blue-400 font-bold uppercase tracking-widest hover:text-blue-300 transition-colors"
                >
                  Sign In / Sign Up
                </button>
              )}
            </div>
          </div>
          {user && (
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-all text-zinc-400 hover:text-red-400"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          {isAiOffline && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center gap-4 mb-2"
            >
              <div className="p-2.5 bg-amber-500/20 rounded-2xl text-amber-500">
                <ZapOff className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">AI Offline Mode</p>
                <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">Rate limit reached. Using local traffic models.</p>
              </div>
            </motion.div>
          )}
          {/* Daily AI Briefing */}
          <section className="p-5 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="w-12 h-12 text-blue-400" />
            </div>
            <div className="flex items-center gap-2 text-blue-400 mb-3">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">AI Daily Briefing</h3>
            </div>
            {isBriefingLoading ? (
              <div className="space-y-2">
                <div className="h-3 bg-zinc-800 rounded-full w-full animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded-full w-3/4 animate-pulse" />
              </div>
            ) : (
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                {dailyBriefing || "Analyzing current traffic patterns for your morning commute..."}
              </p>
            )}
          </section>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 p-1 bg-zinc-950/50 rounded-2xl border border-zinc-800/50 mb-6">
            <button 
              onClick={() => setActiveTab('explore')}
              className={`flex-1 min-w-[70px] py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'explore' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Explore
            </button>
            <button 
              onClick={() => setActiveTab('navigate')}
              className={`flex-1 min-w-[70px] py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'navigate' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Navigate
            </button>
            <button 
              onClick={() => setActiveTab('predict')}
              className={`flex-1 min-w-[70px] py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'predict' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Predict
            </button>
            <button 
              onClick={() => setActiveTab('pulse')}
              className={`flex-1 min-w-[70px] py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'pulse' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Pulse
            </button>
            <button 
              onClick={() => setActiveTab('performance')}
              className={`flex-1 min-w-[70px] py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === 'performance' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Model
            </button>
          </div>

          {activeTab === 'performance' && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-400">
                  <BarChart3 className="w-4 h-4" />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">LSTM Model Performance</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-zinc-800/30 border border-zinc-700/30 rounded-2xl">
                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">R² Score</p>
                  <p className="text-xl font-mono font-bold text-blue-400">0.938</p>
                  <p className="text-[8px] text-zinc-500 mt-1 italic">High predictive accuracy</p>
                </div>
                <div className="p-4 bg-zinc-800/30 border border-zinc-700/30 rounded-2xl">
                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">MAE</p>
                  <p className="text-xl font-mono font-bold text-purple-400">1.94</p>
                  <p className="text-[8px] text-zinc-500 mt-1 italic">Mean Absolute Error (km/h)</p>
                </div>
              </div>

              <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest">Model Architecture</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">Type</span>
                    <span className="text-zinc-100 font-bold">Bidirectional LSTM</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">Mechanism</span>
                    <span className="text-zinc-100 font-bold">Attention Layer</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">Optimizer</span>
                    <span className="text-zinc-100 font-bold">Adam</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">Loss Function</span>
                    <span className="text-zinc-100 font-bold">MSE</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-blue-500/5 border border-blue-500/20 rounded-3xl">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Training Insight</h4>
                <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                  "The model was trained on 11,967 sequences of Guntur traffic data. The Attention mechanism allows the system to prioritize junctions like Lodge Center and NTR Bus Station, which act as primary flow regulators for the city's network."
                </p>
              </div>
            </section>
          )}

          {activeTab === 'pulse' && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-pink-400">
                  <Activity className="w-4 h-4" />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">City Pulse (AI Events)</h3>
                </div>
                {isPulseLoading && <div className="w-3 h-3 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />}
              </div>
              
              <div className="space-y-4">
                {cityPulse.length > 0 ? (
                  cityPulse.map((event, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={`pulse-event-${event.id}-${idx}`} 
                      className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-2xl space-y-2 group hover:border-pink-500/30 transition-all"
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                          event.impact === 'critical' ? 'bg-red-500/20 text-red-400' :
                          event.impact === 'high' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {event.impact} Impact
                        </span>
                        <span className="text-[8px] font-bold text-zinc-500 uppercase">{event.type}</span>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-100">{event.title}</h4>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">{event.description}</p>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </div>
                        {event.sourceUrl && (
                          <a 
                            href={event.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[9px] text-pink-400 hover:underline font-bold"
                          >
                            Source
                          </a>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <p className="text-xs text-zinc-500">No major events detected currently.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'navigate' && (
            <>
              {/* Route Details or Planner */}
              {selectedRouteId ? (
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => {
                          setSelectedRouteId(null);
                          setAlternativeRoutes([]);
                          setRouteAdvice(null);
                        }}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                      >
                        <ArrowRight className="w-3 h-3 rotate-180" />
                        Back to Planner
                      </button>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setShowCompareModal(true)}
                          className="p-2 bg-zinc-800 text-zinc-400 hover:text-blue-400 rounded-lg transition-all"
                          title="Compare Routes"
                        >
                          <Columns className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => selectedRoute && handleSaveRoute(selectedRoute)}
                          className={`p-2 rounded-lg transition-all ${
                            user?.savedRoutes?.some(r => r.start === routeStart && r.end === routeEnd)
                              ? 'bg-blue-600/20 text-blue-400'
                              : 'bg-zinc-800 text-zinc-400 hover:text-blue-400'
                          }`}
                        >
                          <Bookmark className="w-4 h-4" fill={user?.savedRoutes?.some(r => r.start === routeStart && r.end === routeEnd) ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </div>

                  <div className="p-6 bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-3xl space-y-4">
                    <div className="flex justify-between items-start">
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest rounded">
                        {selectedRoute?.type}
                      </span>
                      <div className="text-right">
                        <p className="text-3xl font-black tracking-tighter text-zinc-100">{selectedRoute?.estimatedTime}m</p>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Estimated Time</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                      <div>
                        <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Distance</p>
                        <p className="text-sm font-bold text-zinc-100">{selectedRoute?.totalDistance} km</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Congestion</p>
                        <p className={`text-sm font-bold ${
                          selectedRoute && selectedRoute.congestionLevel < 30 ? 'text-green-400' :
                          selectedRoute && selectedRoute.congestionLevel < 60 ? 'text-orange-400' : 'text-red-400'
                        }`}>{selectedRoute?.congestionLevel}%</p>
                      </div>
                    </div>
                  </div>

                  {/* AI Route Comparison & Advice */}
                  {alternativeRoutes.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2 text-purple-400">
                        <Sparkles className="w-4 h-4" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest">AI Route Comparison</h4>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        {alternativeRoutes.map((route, idx) => (
                          <button
                            key={`alt-route-btn-${route.id}-${idx}`}
                            onClick={() => setSelectedRouteId(route.id)}
                            className={`p-4 rounded-2xl border transition-all text-left group ${
                              selectedRouteId === route.id 
                                ? 'bg-purple-600/20 border-purple-500/50 shadow-lg shadow-purple-900/20' 
                                : 'bg-zinc-800/30 border-zinc-700/50 hover:border-purple-500/30'
                            }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                route.type === 'fastest' ? 'bg-blue-500/20 text-blue-400' :
                                route.type === 'shortest' ? 'bg-green-500/20 text-green-400' :
                                'bg-purple-500/20 text-purple-400'
                              }`}>
                                {route.type}
                              </span>
                              <span className="text-xs font-bold text-zinc-100">{route.estimatedTime}m</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-zinc-500">
                              <span>{route.totalDistance} km</span>
                              <span>{route.signalCount} signals</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {isAdviceLoading ? (
                        <div className="p-8 flex flex-col items-center justify-center gap-3 bg-zinc-900/50 rounded-3xl border border-zinc-800 border-dashed">
                          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">AI is analyzing routes...</p>
                        </div>
                      ) : routeAdvice && (
                        <div className="p-5 bg-zinc-900/80 border border-purple-500/30 rounded-3xl space-y-4 shadow-xl">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-xl">
                              <MessageSquare className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">AI Recommendation</p>
                              <p className="text-xs text-zinc-200 leading-relaxed font-medium">
                                {routeAdvice.justification}
                              </p>
                            </div>
                          </div>
                          
                          {/* AI Traffic Forecast */}
                          {predictions.length > 0 && selectedRoute && (
                            <div className="pt-4 border-t border-zinc-800 space-y-3">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-3 h-3 text-blue-400" />
                                <p className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">AI Traffic Forecast (Next 20m)</p>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {selectedRoute.path.slice(0, 3).map((nodeId, idx) => {
                                  const pred = predictions.find(p => p.locationId === nodeId);
                                  if (!pred) return null;
                                  return (
                                    <div key={`route-pred-${nodeId}-${idx}`} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                          pred.trend === 'improving' ? 'bg-green-500' :
                                          pred.trend === 'worsening' ? 'bg-red-500' : 'bg-orange-500'
                                        }`} />
                                        <span className="text-[9px] text-zinc-300 font-medium">
                                          {GUNTUR_LOCATIONS.find(l => l.id === nodeId)?.name || nodeId}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-right">
                                          <p className="text-[7px] text-zinc-500 uppercase tracking-tighter">Congestion</p>
                                          <p className={`text-[9px] font-bold ${
                                            pred.predictedCongestion < 30 ? 'text-green-400' :
                                            pred.predictedCongestion < 60 ? 'text-orange-400' : 'text-red-400'
                                          }`}>{Math.round(pred.predictedCongestion)}%</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[7px] text-zinc-500 uppercase tracking-tighter">Speed</p>
                                          <p className="text-[9px] font-bold text-zinc-100">{Math.round(pred.predictedSpeed)} km/h</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                            <div className="space-y-2">
                              <p className="text-[8px] font-bold text-green-400 uppercase tracking-widest">Pros</p>
                              {routeAdvice.pros.map((pro, i) => (
                                <div key={`pro-${i}-${pro.substring(0, 10)}`} className="flex items-center gap-1.5">
                                  <ShieldCheck className="w-2.5 h-2.5 text-green-500" />
                                  <span className="text-[9px] text-zinc-400">{pro}</span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <p className="text-[8px] font-bold text-red-400 uppercase tracking-widest">Cons</p>
                              {routeAdvice.cons.map((con, i) => (
                                <div key={`con-${i}-${con.substring(0, 10)}`} className="flex items-center gap-1.5">
                                  <AlertTriangle className="w-2.5 h-2.5 text-red-500" />
                                  <span className="text-[9px] text-zinc-400">{con}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Eco Advice UI */}
                  {ecoAdvice && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-5 bg-green-600/10 border border-green-500/20 rounded-3xl space-y-3"
                    >
                      <div className="flex items-center gap-2 text-green-400">
                        <Leaf className="w-4 h-4" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest">Eco-Friendly Advice</h4>
                      </div>
                      <p className="text-[10px] text-zinc-300 leading-relaxed italic">"{ecoAdvice}"</p>
                    </motion.div>
                  )}
                </section>
              ) : (
                <>
                  {/* Route Planner */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-400">
                      <Navigation className="w-4 h-4" />
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">Route Planner</h3>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <MapPin className="w-4 h-4 text-blue-500" />
                        </div>
                        <select 
                          value={routeStart}
                          onChange={(e) => setRouteStart(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm font-medium outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-all appearance-none cursor-pointer text-zinc-200"
                        >
                          <option value="" disabled>Select Source</option>
                          {GUNTUR_LOCATIONS.map(loc => <option key={`start-${loc.id}`} value={loc.id}>{loc.name}</option>)}
                        </select>
                      </div>

                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                          <MapPin className="w-4 h-4 text-red-500" />
                        </div>
                        <select 
                          value={routeEnd}
                          onChange={(e) => setRouteEnd(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm font-medium outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-all appearance-none cursor-pointer text-zinc-200"
                        >
                          <option value="" disabled>Select Destination</option>
                          {GUNTUR_LOCATIONS.map(loc => <option key={`end-${loc.id}`} value={loc.id}>{loc.name}</option>)}
                        </select>
                      </div>

                      {/* Emergency Mode Toggle */}
                      <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        isEmergency 
                          ? 'bg-red-600/10 border-red-500/50 shadow-lg shadow-red-900/20' 
                          : 'bg-zinc-800/50 border-zinc-700/50'
                      }`}>
                        <div className="flex items-center gap-3">
                          <ShieldAlert className={`w-5 h-5 ${isEmergency ? 'text-red-500 animate-pulse' : 'text-white/20'}`} />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest">Emergency Mode</p>
                            <p className="text-[10px] opacity-40 uppercase">Prioritize Speed & Signals</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setIsEmergency(!isEmergency)}
                          className={`w-12 h-6 rounded-full transition-all relative ${isEmergency ? 'bg-red-600' : 'bg-white/10'}`}
                        >
                          <motion.div 
                            animate={{ x: isEmergency ? 26 : 2 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                          />
                        </button>
                      </div>

                      <button 
                        onClick={() => handleRouteSearch('alternate')}
                        disabled={isFindingAlternatives || isAdviceLoading}
                        className="w-full py-4 bg-blue-700 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isFindingAlternatives || isAdviceLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Navigation className="w-4 h-4" />
                        )}
                        {isFindingAlternatives ? 'Finding Alternatives...' : isAdviceLoading ? 'AI Analyzing...' : 'Find Best Routes'}
                      </button>

                      {/* Route Selection List */}
                      {routes.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-zinc-800/50">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Available Routes</h4>
                            <button 
                              onClick={() => setShowCompareModal(true)}
                              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-[9px] font-bold rounded-lg transition-all border border-blue-500/20"
                            >
                              <Columns className="w-3 h-3" />
                              Compare All
                            </button>
                          </div>
                          <div className="space-y-2">
                            {routes.map((route, idx) => (
                              <button
                                key={`route-btn-sidebar-${route.id}-${idx}`}
                                onClick={() => setSelectedRouteId(route.id)}
                                className={`w-full p-4 rounded-2xl border transition-all text-left ${
                                  selectedRouteId === route.id 
                                    ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-900/10' 
                                    : 'bg-zinc-800/30 border-zinc-700/50 hover:border-zinc-600'
                                }`}
                              >
                                <div className="flex justify-between items-center mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                      route.type === 'fastest' ? 'bg-blue-500/20 text-blue-400' :
                                      route.type === 'shortest' ? 'bg-green-500/20 text-green-400' :
                                      'bg-purple-500/20 text-purple-400'
                                    }`}>
                                      {route.type}
                                    </span>
                                    {routeAdvice?.recommendedRouteId === route.id && (
                                      <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-sparkles text-blue-400">
                                        <Sparkles className="w-2.5 h-2.5" />
                                        AI Choice
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs font-bold text-zinc-100">{route.estimatedTime}m</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-zinc-400">{route.totalDistance} km</span>
                                  <div className="flex items-center gap-1">
                                    <Signal className={`w-3 h-3 ${route.congestionLevel > 50 ? 'text-red-400' : 'text-green-400'}`} />
                                    <span className="text-[9px] text-zinc-500 font-bold">{route.congestionLevel}%</span>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Route Advice */}
                      {(isAdviceLoading || routeAdvice) && (
                        <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4">
                          <div className="flex items-center gap-2 text-blue-400">
                            <Sparkles className="w-4 h-4" />
                            <h4 className="text-[10px] font-bold uppercase tracking-widest">AI Route Advisor</h4>
                          </div>
                          
                          {isAdviceLoading ? (
                            <div className="flex items-center gap-3 py-2">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              <p className="text-[10px] text-zinc-500 animate-pulse">Analyzing traffic patterns & signals...</p>
                            </div>
                          ) : routeAdvice && (
                            <div className="space-y-3">
                              <p className="text-[11px] text-zinc-300 leading-relaxed font-medium italic">
                                "{routeAdvice.justification}"
                              </p>

                              {/* AI Traffic Forecast in Modal */}
                              {predictions.length > 0 && selectedRoute && (
                                <div className="pt-3 border-t border-zinc-800/50 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="w-3 h-3 text-blue-400" />
                                    <p className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">AI Traffic Forecast (Next 20m)</p>
                                  </div>
                                  <div className="grid grid-cols-1 gap-1.5">
                                    {selectedRoute.path.slice(0, 2).map((nodeId, idx) => {
                                      const pred = predictions.find(p => p.locationId === nodeId);
                                      if (!pred) return null;
                                      return (
                                        <div key={`modal-route-pred-${nodeId}-${idx}`} className="flex items-center justify-between p-1.5 bg-zinc-800/30 rounded-lg border border-zinc-700/20">
                                          <div className="flex items-center gap-1.5">
                                            <div className={`w-1 h-1 rounded-full ${
                                              pred.trend === 'improving' ? 'bg-green-500' :
                                              pred.trend === 'worsening' ? 'bg-red-500' : 'bg-orange-500'
                                            }`} />
                                            <span className="text-[8px] text-zinc-300">
                                              {GUNTUR_LOCATIONS.find(l => l.id === nodeId)?.name || nodeId}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 text-[8px]">
                                            <span className={pred.predictedCongestion < 30 ? 'text-green-400' : pred.predictedCongestion < 60 ? 'text-orange-400' : 'text-red-400'}>
                                              {Math.round(pred.predictedCongestion)}%
                                            </span>
                                            <span className="text-zinc-500">|</span>
                                            <span className="text-zinc-100">{Math.round(pred.predictedSpeed)} km/h</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800/50">
                                <div className="space-y-1.5">
                                  <p className="text-[8px] font-bold text-green-500 uppercase tracking-widest">Pros</p>
                                  {routeAdvice.pros.map((pro, i) => (
                                    <div key={`pro-det-${i}-${pro.substring(0, 10)}`} className="flex items-center gap-1.5">
                                      <div className="w-1 h-1 bg-green-500 rounded-full" />
                                      <p className="text-[9px] text-zinc-400">{pro}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-[8px] font-bold text-red-500 uppercase tracking-widest">Cons</p>
                                  {routeAdvice.cons.map((con, i) => (
                                    <div key={`con-det-${i}-${con.substring(0, 10)}`} className="flex items-center gap-1.5">
                                      <div className="w-1 h-1 bg-red-500 rounded-full" />
                                      <p className="text-[9px] text-zinc-400">{con}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Saved Routes */}
                  {user?.savedRoutes && user.savedRoutes.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Bookmark className="w-4 h-4" />
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">Saved Routes</h3>
                      </div>
                      <div className="space-y-2">
                        {user.savedRoutes.map((saved, idx) => (
                          <button
                            key={`saved-route-${saved.id}-${idx}`}
                            onClick={() => handleLoadSavedRoute(saved)}
                            className="w-full p-4 bg-zinc-800/30 border border-zinc-700/30 rounded-xl hover:border-blue-500/30 transition-all text-left group"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-[10px] font-bold text-zinc-100 uppercase tracking-tight">
                                {GUNTUR_LOCATIONS.find(l => l.id === saved.start)?.name} → {GUNTUR_LOCATIONS.find(l => l.id === saved.end)?.name}
                              </p>
                              <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-blue-400 transition-colors" />
                            </div>
                            <p className="text-[9px] text-zinc-500 font-medium uppercase tracking-widest">
                              {saved.details.estimatedTime} min • {saved.details.totalDistance} km
                            </p>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* Parking Prediction UI */}
              {parkingPrediction && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-400">
                      <ParkingCircle className="w-4 h-4" />
                      <h4 className="text-[10px] font-bold uppercase tracking-widest">AI Parking Forecast</h4>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      parkingPrediction.probability > 0.7 ? 'text-green-400' :
                      parkingPrediction.probability > 0.4 ? 'text-orange-400' : 'text-red-400'
                    }`}>
                      {Math.round(parkingPrediction.probability * 100)}% Available
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-tight">{parkingPrediction.reasoning}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className={`w-3 h-3 ${
                        parkingPrediction.trend === 'filling' ? 'text-red-400 rotate-45' :
                        parkingPrediction.trend === 'clearing' ? 'text-green-400 -rotate-45' : 'text-zinc-500'
                      }`} />
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                        Trend: {parkingPrediction.trend}
                      </span>
                    </div>
                    {parkingPrediction.bestAlternative && (
                      <span className="text-[9px] text-blue-400 font-bold italic">
                        Alt: {parkingPrediction.bestAlternative}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </>
          )}

          {activeTab === 'predict' && (
            <>
              {/* Traffic Predictions */}
              <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400">
                <TrendingUp className="w-4 h-4" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">Traffic Predictions</h3>
              </div>
              <div className="flex gap-1">
                {[10, 20, 30].map(m => (
                  <button
                    key={`pred-btn-${m}`}
                    onClick={async () => {
                      setSelectedTimeHorizon(m);
                      setIsPredicting(true);
                      try {
                        const res = await getTrafficForecast([...trafficData, ...trafficEdgesData], m);
                        setPredictions(res);
                      } catch (err) {
                        console.error("Failed to get traffic forecast:", err);
                      } finally {
                        setIsPredicting(false);
                      }
                    }}
                    className={`px-2 py-1 border rounded text-[9px] font-bold transition-all ${
                      selectedTimeHorizon === m 
                        ? 'bg-purple-600 border-purple-400 text-white' 
                        : 'bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/50 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {isPredicting ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto opacity-50"></div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Analyzing Trends for {selectedTimeHorizon}m</p>
                </div>
              ) : (
                predictions.map((pred, idx) => (
                  <div key={`pred-card-${pred.id}-${idx}`} className="p-4 bg-zinc-800/30 border border-zinc-700/30 rounded-xl hover:border-zinc-700 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-tight text-zinc-100">{pred.locationId}</h4>
                        {pred.attentionScore && pred.attentionScore > 0.7 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                            <span className="text-[8px] text-purple-400 font-bold uppercase tracking-widest">High Attention</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          pred.trend === 'improving' ? 'bg-green-500/10 text-green-400' : 
                          pred.trend === 'worsening' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-500/10 text-zinc-400'
                        }`}>
                          {pred.trend}
                        </span>
                        <span className="text-[8px] text-zinc-500 font-mono">{(pred.confidence * 100).toFixed(0)}% conf</span>
                      </div>
                    </div>
                    <div className="flex gap-4 mb-2">
                      <div>
                        <p className="text-[8px] uppercase text-zinc-500 font-bold">Speed</p>
                        <p className="text-xs font-mono font-bold text-zinc-100">{Math.round(pred.predictedSpeed)} km/h</p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase text-zinc-500 font-bold">Congestion</p>
                        <p className="text-xs font-mono font-bold text-zinc-100">{Math.round(pred.predictedCongestion)}%</p>
                      </div>
                    </div>
                    <p className="text-[9px] text-zinc-500 italic leading-tight mb-3">"{pred.reasoning}"</p>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                        <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">AI Reasoning Active</span>
                      </div>
                      <button 
                        onClick={() => handleValidate(pred.id)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${
                          validatedPredictions.has(pred.id) 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-700/50'
                        }`}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {validatedPredictions.has(pred.id) ? 'Validated' : 'Validate'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* MARL Optimization */}
          <section className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-400">
                <Zap className="w-4 h-4" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">MARL Optimization</h3>
              </div>
              <button 
                onClick={handleOptimize}
                disabled={isOptimizing}
                className={`px-3 py-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 text-[10px] font-bold rounded-lg transition-all border border-green-500/20 ${isOptimizing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isOptimizing ? 'Optimizing...' : 'Optimize Now'}
              </button>
            </div>
            {optimizationStatus && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[10px] text-green-400/80 font-medium text-center"
              >
                {optimizationStatus}
              </motion.p>
            )}
            {!optimizationStatus && (
              <p className="text-[10px] text-zinc-500 leading-relaxed text-center italic">
                Click optimize to start multi-agent RL simulation
              </p>
            )}
          </section>

          {/* Map Layers */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-blue-400">
              <MapIcon className="w-4 h-4" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">Map Layers</h3>
            </div>
            <div className="flex items-center justify-between p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl hover:border-zinc-600 transition-all">
              <div className="flex items-center gap-3">
                <Flame className={`w-4 h-4 ${showHeatmap ? 'text-orange-500' : 'text-zinc-600'}`} />
                <span className="text-xs font-medium text-zinc-300">Traffic Heatmap</span>
              </div>
              <button 
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`w-10 h-5 rounded-full transition-all relative ${showHeatmap ? 'bg-blue-600' : 'bg-zinc-800'}`}
              >
                <motion.div 
                  animate={{ x: showHeatmap ? 22 : 2 }}
                  className="absolute top-1 w-3 h-3 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
          </section>
            </>
          )}

          {activeTab === 'explore' && (
            <>
              {/* Public Transport */}
              <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-400">
                <Bus className="w-4 h-4" />
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">Public Transport</h3>
              </div>
              <button 
                onClick={async () => {
                  setIsLoadingTransport(true);
                  const info = await getPublicTransportInfo("Guntur");
                  setPublicTransport(info);
                  setIsLoadingTransport(false);
                }}
                className="p-1 hover:bg-zinc-800 rounded transition-all"
              >
                <Zap className="w-3 h-3 text-zinc-500" />
              </button>
            </div>

            <div className="space-y-3">
              {isLoadingTransport ? (
                <div className="py-4 text-center opacity-40 text-[9px] font-bold uppercase tracking-widest">
                  Fetching Schedules...
                </div>
              ) : (
                publicTransport.map((item, idx) => (
                  <div key={`transport-item-${item.id}-${idx}`} className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl space-y-2 hover:border-zinc-600 transition-all">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {item.type === 'bus' ? <Bus className="w-3 h-3 text-blue-400" /> : <MapIcon className="w-3 h-3 text-green-400" />}
                        <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-100">{item.route}</span>
                      </div>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        item.status === 'on-time' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] text-zinc-500">{item.location}</p>
                      <p className="text-xs font-black text-blue-400">{item.nextArrival}</p>
                    </div>
                    <p className="text-[9px] text-zinc-600 italic leading-tight">{item.details}</p>
                    {item.mapsUrl && (
                      <a 
                        href={item.mapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[9px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors"
                      >
                        View on Maps <ArrowRight className="w-2 h-2" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Parking Areas */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <ParkingCircle className="w-4 h-4" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">Parking Availability</h3>
            </div>
            <div className="space-y-3">
              {PARKING_AREAS.map((parking, idx) => {
                const occupancyRate = (parking.occupied / parking.capacity) * 100;
                return (
                  <div key={`parking-card-${parking.id}-${idx}`} className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl space-y-3 hover:border-zinc-600 transition-all">
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-bold uppercase tracking-tight text-zinc-100">{parking.name}</p>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        occupancyRate > 90 ? 'bg-red-500/10 text-red-400' : occupancyRate > 70 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'
                      }`}>
                        {Math.round(occupancyRate)}% Full
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                        <span>Occupancy</span>
                        <span>{parking.occupied} / {parking.capacity}</span>
                      </div>
                      <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${occupancyRate}%` }}
                          className={`h-full ${
                            occupancyRate > 90 ? 'bg-red-500' : occupancyRate > 70 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Real-time Updates */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-orange-400">
              <Activity className="w-4 h-4" />
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]">Real-time Updates</h3>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {notifications.map((notif, idx) => (
                  <motion.div
                    key={`notif-${notif.id}-${idx}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`p-3 rounded-xl border flex gap-3 transition-all ${
                      notif.type === 'warning' ? 'bg-red-500/5 border-red-500/20' : 'bg-blue-500/5 border-blue-500/20'
                    }`}
                  >
                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      notif.type === 'warning' ? 'bg-red-500' : 'bg-blue-400'
                    }`} />
                    <div className="flex-1">
                      <p className="text-[10px] font-medium text-zinc-200 leading-tight">{notif.message}</p>
                      <p className="text-[8px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">{notif.time}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {notifications.length === 0 && (
                <p className="text-[10px] text-white/20 text-center italic">No recent updates</p>
              )}
            </div>
          </section>
        </>
      )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        <MapContainer center={[16.3067, 80.4365]} zoom={14} className="h-full w-full">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          
          {showHeatmap && <HeatmapLayer points={heatmapPoints} />}

          {/* Smart Traffic Management Badge */}
          <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-xl font-bold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Smart Traffic Management
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute top-6 right-6 z-[1000] flex flex-col gap-2">
            <button 
              onClick={() => setShowTrafficEdges(!showTrafficEdges)}
              className={`p-3 rounded-xl shadow-xl transition-all border ${
                showTrafficEdges ? 'bg-blue-600 border-blue-400 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
              title="Toggle Traffic Network"
            >
              {showTrafficEdges ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`p-3 rounded-xl shadow-xl transition-all border ${
                showHeatmap ? 'bg-orange-600 border-orange-400 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}
              title="Toggle Heatmap"
            >
              <Layers className="w-5 h-5" />
            </button>
          </div>

          {/* Floating Emergency Toggle */}
          <div className="absolute bottom-6 right-6 z-[1000] flex flex-col items-end gap-4">
            {/* Voice Guide Button */}
            <button 
              onClick={() => setShowVoiceGuide(true)}
              className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all shadow-xl flex items-center gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Voice Help</span>
            </button>
            
            <button 
              onClick={() => setIsEmergency(!isEmergency)}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl transition-all border-2 ${
                isEmergency 
                  ? 'bg-red-600 border-white/20 text-white' 
                  : 'bg-[#1a1f2e] border-white/5 text-white/50 hover:text-white hover:border-white/20'
              }`}
            >
              <ShieldAlert className={`w-5 h-5 ${isEmergency ? 'text-white animate-pulse' : 'text-red-500'}`} />
              <span className="text-xs font-black uppercase tracking-widest">
                {isEmergency ? 'Emergency Active' : 'Emergency Mode'}
              </span>
            </button>
          </div>

          {trafficData.map((loc, idx) => {
            const prediction = predictions.find(p => p.locationId === loc.id);
            return (
              <Marker 
                key={`marker-loc-${loc.id}-${idx}`} 
                position={[loc.lat, loc.lng]}
                icon={L.divIcon({
                  className: 'custom-marker',
                  html: `<div style="background-color: ${loc.congestion > 60 ? '#ef4444' : loc.congestion > 30 ? '#f59e0b' : '#10b981'}; border: 2px solid white; border-radius: 50%; width: 14px; height: 14px; box-shadow: 0 0 15px rgba(0,0,0,0.3);"></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7]
                })}
              >
                <Popup>
                  <div className="p-3 font-sans min-w-[200px] bg-zinc-900 text-white rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-black text-xs uppercase tracking-wider">{loc.name}</h3>
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 uppercase tracking-tighter">Node: {loc.id}</span>
                        <span className="text-[7px] text-zinc-500 mt-0.5">Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <p className="text-[8px] uppercase text-zinc-500 font-bold mb-1">Current Speed</p>
                        <p className="text-xs font-mono font-bold text-blue-400">{Math.round(loc.speed)} km/h</p>
                      </div>
                      <div className="p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <p className="text-[8px] uppercase text-zinc-500 font-bold mb-1">Congestion</p>
                        <p className={`text-xs font-mono font-bold ${loc.congestion > 60 ? 'text-red-400' : loc.congestion > 30 ? 'text-orange-400' : 'text-green-400'}`}>
                          {Math.round(loc.congestion)}%
                        </p>
                      </div>
                    </div>

                    {prediction ? (
                      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg space-y-1">
                        <div className="flex items-center gap-1 text-blue-400 mb-1">
                          <Zap className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">AI Forecast</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-zinc-400">Predicted Speed</span>
                          <span className="text-[10px] font-mono font-bold text-blue-300">{Math.round(prediction.predictedSpeed)} km/h</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-zinc-400">Trend</span>
                          <span className={`text-[9px] font-bold uppercase ${prediction.trend === 'improving' ? 'text-green-400' : 'text-red-400'}`}>
                            {prediction.trend}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-1 opacity-40">
                        <p className="text-[8px] uppercase font-bold tracking-widest">No AI Forecast Loaded</p>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Background Traffic Network (Edges) */}
          {showTrafficEdges && trafficEdgesData.map((edge, idx) => {
            const sourceNode = GUNTUR_LOCATIONS.find(l => l.id === edge.source);
            const targetNode = GUNTUR_LOCATIONS.find(l => l.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const positions = edge.geometry || [[sourceNode.lat, sourceNode.lng], [targetNode.lat, targetNode.lng]];
            const color = edge.congestion > 70 ? '#ef4444' : edge.congestion > 40 ? '#f59e0b' : '#10b981';
            const prediction = predictions.find(p => p.locationId === edge.id);

            return (
              <Polyline
                key={`network-edge-${edge.id}-${idx}`}
                positions={positions}
                color={color}
                weight={selectedRouteId ? 1.5 : 3}
                opacity={selectedRouteId ? 0.05 : 0.3}
                className="network-edge"
              >
                <Popup>
                  <div className="p-3 font-sans min-w-[220px] bg-zinc-900 text-white rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-black text-[10px] uppercase tracking-wider">{sourceNode.name} → {targetNode.name}</h3>
                      <span className="text-[7px] text-zinc-500">Live Data</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <p className="text-[8px] uppercase text-zinc-500 font-bold mb-1">Avg Speed</p>
                        <p className="text-xs font-mono font-bold text-blue-400">{Math.round(edge.speed)} km/h</p>
                      </div>
                      <div className="p-2 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                        <p className="text-[8px] uppercase text-zinc-500 font-bold mb-1">Congestion</p>
                        <p className={`text-xs font-mono font-bold ${edge.congestion > 70 ? 'text-red-400' : edge.congestion > 40 ? 'text-orange-400' : 'text-green-400'}`}>
                          {Math.round(edge.congestion)}%
                        </p>
                      </div>
                    </div>

                    {prediction && (
                      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-2 space-y-1">
                        <div className="flex items-center gap-1 text-blue-400 mb-1">
                          <Zap className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">AI Prediction</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-zinc-400">Next 30m</span>
                          <span className={`text-[10px] font-mono font-bold ${prediction.trend === 'improving' ? 'text-green-400' : 'text-red-400'}`}>
                            {Math.round(prediction.predictedSpeed)} km/h
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[9px] text-zinc-500 border-t border-zinc-800 pt-2">
                      <span>Distance: {edge.distance} km</span>
                      <span>Signals: {edge.signals}</span>
                    </div>
                  </div>
                </Popup>
              </Polyline>
            );
          })}

          {/* Routes with Glow Effect for better visibility */}
          {routes.map((route, idx) => (
            <React.Fragment key={`route-group-${route.id}-${idx}`}>
              {/* Outer Glow/Outline */}
              <Polyline 
                positions={route.fullPath} 
                color="white" 
                weight={selectedRouteId === route.id ? 16 : 8} 
                opacity={selectedRouteId === route.id ? 0.4 : 0.15}
              />
              {/* Main Route Line */}
              <Polyline 
                positions={route.fullPath} 
                color={selectedRouteId === route.id 
                  ? (isEmergency ? "#ef4444" : "#3b82f6") 
                  : "#64748b"} 
                weight={selectedRouteId === route.id ? 8 : 4} 
                opacity={selectedRouteId === route.id ? 1 : 0.6}
                dashArray={selectedRouteId === route.id ? undefined : "10, 10"}
              >
                <Popup>
                  <div className="p-3 bg-zinc-900 text-white rounded-lg min-w-[150px]">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">{route.type} Route</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">{route.estimatedTime} min</span>
                      <span className="text-[9px] text-zinc-500">{route.totalDistance} km</span>
                    </div>
                  </div>
                </Popup>
              </Polyline>
            </React.Fragment>
          ))}

          {/* Traffic Signals on Selected Route */}
          {selectedRoute && selectedRoute.signalLocations.map((pos, idx) => (
            <Marker 
              key={`signal-${selectedRoute.id}-${idx}`}
              position={pos}
              icon={L.divIcon({
                className: 'signal-marker',
                html: `<div style="background-color: #ef4444; border: 2px solid white; border-radius: 50%; width: 10px; height: 10px; box-shadow: 0 0 5px rgba(239, 68, 68, 0.5);"></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5]
              })}
            >
              <Popup>
                <div className="p-1 text-[10px] font-bold uppercase tracking-widest text-red-600">
                  Traffic Signal
                </div>
              </Popup>
            </Marker>
          ))}

          {/* AI Attention Markers (Influential Junctions) */}
          {predictions.filter(p => (p.attentionScore || 0) > 0.7).map((pred, idx) => {
            const loc = GUNTUR_LOCATIONS.find(l => l.id === pred.locationId || l.name === pred.locationId);
            if (!loc) return null;
            return (
              <Marker 
                key={`attention-${pred.id}-${idx}`}
                position={[loc.lat, loc.lng]}
                icon={L.divIcon({
                  className: 'attention-marker',
                  html: `<div style="background-color: rgba(168, 85, 247, 0.2); border: 2px solid #a855f7; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; animation: pulse-purple 2s infinite;">
                    <div style="background-color: #a855f7; width: 8px; height: 8px; border-radius: 50%;"></div>
                  </div>`,
                  iconSize: [30, 30],
                  iconAnchor: [15, 15]
                })}
              >
                <Popup>
                  <div className="p-2 font-sans">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-purple-500" />
                      <h3 className="font-bold text-[10px] uppercase tracking-widest">AI Attention Point</h3>
                    </div>
                    <p className="text-[9px] text-zinc-600 leading-tight">
                      LSTM model is prioritizing <strong>{loc.name}</strong> as a critical influence on urban flow.
                    </p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Parking Area Markers */}
          {PARKING_AREAS.map((parking, idx) => (
            <Marker 
              key={`marker-pkg-${parking.id}-${idx}`}
              position={[parking.lat, parking.lng]}
              icon={L.divIcon({
                className: 'parking-marker',
                html: `<div style="background-color: #6366f1; color: white; border-radius: 6px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 0 10px rgba(99, 102, 241, 0.4);">P</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            >
              <Popup>
                <div className="p-2 font-sans min-w-[150px]">
                  <div className="flex items-center gap-2 mb-2">
                    <ParkingCircle className="w-4 h-4 text-indigo-500" />
                    <h3 className="font-bold text-xs uppercase">{parking.name}</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="opacity-60">Capacity:</span>
                      <span className="font-bold">{parking.capacity}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="opacity-60">Occupied:</span>
                      <span className="font-bold">{parking.occupied}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${(parking.occupied / parking.capacity) * 100}%` }}
                        className={`h-full ${
                          (parking.occupied / parking.capacity) > 0.9 ? 'bg-red-500' : (parking.occupied / parking.capacity) > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Start/End Markers */}
          {selectedRoute && (
            <>
              {(() => {
                const startNode = GUNTUR_LOCATIONS.find(n => n.id === routeStart);
                if (!startNode) return null;
                return (
                  <Marker 
                    key="start-marker"
                    position={[startNode.lat, startNode.lng]}
                    icon={L.divIcon({
                      className: 'start-marker',
                      html: `<div style="background-color: #141414; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; border: 2px solid white;">A</div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  />
                );
              })()}
              {(() => {
                const endNode = GUNTUR_LOCATIONS.find(n => n.id === routeEnd);
                if (!endNode) return null;
                return (
                  <Marker 
                    key="end-marker"
                    position={[endNode.lat, endNode.lng]}
                    icon={L.divIcon({
                      className: 'end-marker',
                      html: `<div style="background-color: #ef4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; border: 2px solid white;">B</div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  />
                );
              })()}
            </>
          )}
        </MapContainer>

        {/* Voice Assistant Trigger */}
        <div className="absolute bottom-10 left-10 z-[1000]">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={startVoiceAssistant}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${
              isVoiceActive ? 'bg-red-600 animate-pulse' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isVoiceActive ? <MicOff className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
          </motion.button>
        </div>

        {/* Voice Overlay */}
        <AnimatePresence>
          {isVoiceActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 left-10 z-[1000] w-80 p-6 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[1, 2, 3].map((i, idx) => (
                    <motion.div
                      key={`listening-bar-${i}-${idx}`}
                      animate={{ height: [8, 24, 8] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                      className="w-1 bg-blue-500 rounded-full"
                    />
                  ))}
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-400">AI Listening</p>
              </div>
              <p className="text-sm font-medium text-zinc-100 italic">"{voiceTranscript}"</p>
              {voiceResponse && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-4 border-t border-zinc-800 flex gap-3"
                >
                  <Volume2 className="w-4 h-4 text-zinc-500 shrink-0" />
                  <p className="text-xs text-zinc-400 leading-relaxed">{voiceResponse}</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Controls Overlay */}
        <div className="absolute top-6 right-6 flex flex-col gap-3 z-[1000]">
          <div className="bg-zinc-900/90 backdrop-blur-xl p-5 rounded-[24px] shadow-2xl border border-zinc-800/50 max-w-[220px]">
            <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] mb-4 text-zinc-500">Map Legend</h4>
            <div className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="w-6 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-300">Fastest Route</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-1 bg-zinc-700 border-t border-dashed border-zinc-500 rounded-full" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-500">Shortest Path</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-300">Congestion Zone</span>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Alert Banner */}
        <AnimatePresence>
          {isEmergency && (
            <motion.div 
              initial={{ y: -100, x: '-50%' }}
              animate={{ y: 0, x: '-50%' }}
              exit={{ y: -100, x: '-50%' }}
              className="absolute top-6 left-1/2 bg-red-600 text-white px-6 py-3.5 rounded-[20px] shadow-2xl z-[1000] flex items-center gap-4 border border-red-500/50 backdrop-blur-xl"
            >
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] leading-none">Emergency Priority Active</p>
                <p className="text-[9px] font-bold opacity-80 uppercase mt-1.5 tracking-wider">Traffic signals optimized for rapid transit</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Voice Guide Modal */}
      <AnimatePresence>
        {showVoiceGuide && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVoiceGuide(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[40px] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-3 text-blue-400">
                <Mic className="w-6 h-6" />
                <h2 className="text-xl font-black uppercase tracking-tighter">Voice Assistant Guide</h2>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Tap the microphone button in the bottom left to start. You can use the following commands:
                </p>
                
                <div className="space-y-3">
                  {[
                    { cmd: "Navigate to NTR Circle", desc: "Sets destination and finds fastest route" },
                    { cmd: "What's the traffic like at Market?", desc: "Shows traffic details for a specific junction" },
                    { cmd: "Report an accident", desc: "Opens the incident reporting tool" },
                    { cmd: "Find alternative routes", desc: "Triggers AI route analysis" }
                  ].map((item, i) => (
                    <div key={`guide-${i}`} className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl">
                      <p className="text-xs font-bold text-blue-400 mb-1">"{item.cmd}"</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => setShowVoiceGuide(false)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold uppercase tracking-widest transition-all"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-zinc-950/90 backdrop-blur-xl"
            onClick={() => setShowAuthModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black tracking-tighter text-zinc-100">
                  {authMode === 'login' ? 'Welcome Back' : 'Join Guntur AI'}
                </h2>
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="p-3 hover:bg-zinc-800 rounded-full transition-all text-zinc-500 hover:text-zinc-100"
                >
                  <LogOut className="w-5 h-5 rotate-90" />
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Full Name</label>
                    <input 
                      type="text"
                      required
                      value={authForm.name}
                      onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-all text-zinc-100 placeholder:text-zinc-700"
                      placeholder="John Doe"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Email Address</label>
                  <input 
                    type="email"
                    required
                    value={authForm.email}
                    onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-all text-zinc-100 placeholder:text-zinc-700"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-1">Password</label>
                  <input 
                    type="password"
                    required
                    value={authForm.password}
                    onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-sm outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-all text-zinc-100 placeholder:text-zinc-700"
                    placeholder="••••••••"
                  />
                </div>

                {authError && (
                  <p className="text-xs text-red-400 font-medium text-center">{authError}</p>
                )}

                <button 
                  type="submit"
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20 mt-4"
                >
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>

                <p className="text-center text-xs text-zinc-500 mt-6">
                  {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                  <button 
                    type="button"
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="text-blue-400 font-bold hover:text-blue-300 transition-colors"
                  >
                    {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Route Comparison Modal */}
        <AnimatePresence>
          {showCompareModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-xl"
              onClick={() => setShowCompareModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-md">
                  <div>
                    <h2 className="text-2xl font-black tracking-tighter text-zinc-100">Route Comparison</h2>
                    <p className="text-xs text-zinc-500 uppercase font-bold tracking-widest mt-1">Side-by-side analysis of available paths</p>
                  </div>
                  <button 
                    onClick={() => setShowCompareModal(false)}
                    className="p-3 hover:bg-zinc-800 rounded-full transition-all text-zinc-500 hover:text-zinc-100"
                  >
                    <LogOut className="w-5 h-5 rotate-90" />
                  </button>
                </div>

                <div className="p-8 overflow-x-auto custom-scrollbar">
                  <div className="flex gap-6 min-w-[800px]">
                    {routes.map((route, idx) => (
                      <div 
                        key={`route-card-modal-${route.id}-${idx}`}
                        className={`flex-1 p-6 rounded-3xl border transition-all ${
                          selectedRouteId === route.id 
                            ? 'bg-blue-600/5 border-blue-500/50 ring-1 ring-blue-500/20' 
                            : 'bg-zinc-800/30 border-zinc-800'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            route.type === 'fastest' ? 'bg-blue-500/20 text-blue-400' : 
                            route.type === 'shortest' ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {route.type}
                          </span>
                          <div className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                            route.congestionLevel < 30 ? 'bg-green-500/10 text-green-400' :
                            route.congestionLevel < 60 ? 'bg-orange-500/10 text-orange-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {route.congestionLevel}% Congestion
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div className="text-center py-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Travel Time</p>
                            <h3 className="text-5xl font-black tracking-tighter text-zinc-100">
                              {route.estimatedTime}<span className="text-lg font-medium opacity-40 ml-1">min</span>
                            </h3>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-zinc-800/50 rounded-2xl space-y-1 border border-zinc-700/30">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Distance</p>
                              <div className="flex items-center gap-2">
                                <MapIcon className="w-4 h-4 text-blue-400" />
                                <span className="text-sm font-bold text-zinc-100">{route.totalDistance} km</span>
                              </div>
                            </div>
                            <div className="p-4 bg-zinc-800/50 rounded-2xl space-y-1 border border-zinc-700/30">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Signals</p>
                              <div className="flex items-center gap-2">
                                <Signal className="w-4 h-4 text-orange-400" />
                                <span className="text-sm font-bold text-zinc-100">{route.signalCount} stops</span>
                              </div>
                            </div>
                            <div className="p-4 bg-zinc-800/50 rounded-2xl space-y-1 border border-zinc-700/30">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Signal Delay</p>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-green-400" />
                                <span className="text-sm font-bold text-zinc-100">+{route.signalDelay} min</span>
                              </div>
                            </div>
                            <div className="p-4 bg-zinc-800/50 rounded-2xl space-y-1 border border-zinc-700/30">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Efficiency</p>
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-purple-400" />
                                <span className="text-sm font-bold text-zinc-100">
                                  {Math.round(100 - (route.signalDelay / route.estimatedTime) * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button 
                              onClick={() => {
                                setSelectedRouteId(route.id);
                                setShowCompareModal(false);
                              }}
                              className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                                selectedRouteId === route.id 
                                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                              }`}
                            >
                              {selectedRouteId === route.id ? 'Currently Selected' : 'Select'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveRoute(route);
                              }}
                              className={`p-4 rounded-xl border transition-all ${
                                user?.savedRoutes?.some(r => r.start === routeStart && r.end === routeEnd)
                                  ? 'bg-green-500/10 border-green-500/20 text-green-400 cursor-default'
                                  : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-white'
                              }`}
                              title={user?.savedRoutes?.some(r => r.start === routeStart && r.end === routeEnd) ? "Route Saved" : "Save Route"}
                            >
                              {user?.savedRoutes?.some(r => r.start === routeStart && r.end === routeEnd) ? (
                                <BookmarkCheck className="w-5 h-5" />
                              ) : (
                                <Bookmark className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Incident Modal */}
        <AnimatePresence>
          {showIncidentModal && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-zinc-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500/10 rounded-2xl">
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-zinc-100">AI Incident Reporter</h2>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Real-time Traffic Intelligence</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowIncidentModal(false);
                      setIncidentAnalysis(null);
                    }}
                    className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-8 space-y-6">
                  {!incidentAnalysis ? (
                    <form onSubmit={handleIncidentSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Incident Description</label>
                        <textarea
                          required
                          value={incidentForm.description}
                          onChange={(e) => setIncidentForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Describe what you see (e.g., 'Minor accident near Lodge Centre, blocking one lane')"
                          className="w-full p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl text-sm outline-none focus:border-red-500/50 transition-all min-h-[120px] resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Visual Evidence (Optional)</label>
                        <div className="relative group">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          />
                          <div className="w-full p-8 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-3 group-hover:border-zinc-700 transition-all">
                            {incidentForm.image ? (
                              <img src={incidentForm.image} className="w-full h-32 object-cover rounded-xl" alt="Preview" />
                            ) : (
                              <>
                                <Camera className="w-8 h-8 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Click to upload photo</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isAnalyzingIncident}
                        className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-3"
                      >
                        {isAnalyzingIncident ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>AI Analyzing Incident...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Analyze & Report Incident</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="p-6 bg-zinc-800/50 rounded-3xl border border-zinc-700/50 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              incidentAnalysis.severity === 'critical' ? 'bg-red-500 text-white' :
                              incidentAnalysis.severity === 'high' ? 'bg-orange-500 text-white' : 'bg-blue-500 text-white'
                            }`}>
                              {incidentAnalysis.severity} Severity
                            </span>
                            <h3 className="text-xl font-black text-zinc-100 mt-2 capitalize">{incidentAnalysis.type} Detected</h3>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Impact Radius</p>
                            <p className="text-lg font-black text-zinc-200">{incidentAnalysis.impactRadius} km</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-700/50">
                          <div>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Location</p>
                            <p className="text-xs font-bold text-zinc-200">{incidentAnalysis.location}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Est. Duration</p>
                            <p className="text-xs font-bold text-zinc-200">{incidentAnalysis.estimatedDuration}</p>
                          </div>
                        </div>

                        <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">AI Suggested Action</p>
                          <p className="text-xs text-zinc-300 leading-relaxed font-medium">{incidentAnalysis.suggestedAction}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setShowIncidentModal(false);
                          setIncidentAnalysis(null);
                          setIncidentForm({ description: '', image: null });
                        }}
                        className="w-full py-4 bg-zinc-100 text-zinc-950 rounded-2xl font-bold text-sm hover:bg-white transition-all"
                      >
                        Dismiss & Update Map
                      </button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </AnimatePresence>
    </div>
  );
}
