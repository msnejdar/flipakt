import React, { useState, useEffect, useRef } from 'react';
import AnalysisPanel from './AnalysisPanel';
import PanoramaGallery from './PanoramaGallery';
import PanoramaDemo from './PanoramaDemo';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import 'ol/ol.css';
import XYZ from 'ol/source/XYZ.js';
import { defaults as defaultInteractions, PinchZoom, DragPan, MouseWheelZoom, KeyboardZoom, DragZoom, Draw, Modify } from 'ol/interaction';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Style, Fill, Stroke } from 'ol/style';
import CircleStyle from 'ol/style/Circle.js';
import Feature from 'ol/Feature.js';
import { Point, Polygon } from 'ol/geom';
import { toLonLat, fromLonLat } from 'ol/proj';
import { PanoramaApiService } from '../utils/panoramaApi';

// TypeScript deklarace pro Mapy.cz REST API odpověď

interface IPanoramaExistsOutput {
  /** Panorama meta information */
  info?: {
    /** Pano wgs84 longitude coordinate */
    lon: number;
    /** Pano wgs84 latitude coordinate */
    lat: number;
    /** Create date YYYY-MM-DD hh:mm:ss*/
    date: string;
  };
  /** Panorama exists? */
  exists: boolean;
}

// Používáme REST API místo JavaScript SDK

interface MapViewProps {
  onBack: () => void;
}

const MapView: React.FC<MapViewProps> = ({ onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const wheelHandlerRef = useRef<((event: WheelEvent) => void) | null>(null);
  const keyHandlerRef = useRef<((event: KeyboardEvent) => void) | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const drawInteractionRef = useRef<Draw | null>(null);
  const modifyInteractionRef = useRef<Modify | null>(null);
  const mountedRef = useRef(false); // Guard proti double mounting
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [hasPolygon, setHasPolygon] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [panoramaLocations, setPanoramaLocations] = useState<{lon: number, lat: number}[]>([]);
  const [panoramaLayer, setPanoramaLayer] = useState<VectorLayer<VectorSource> | null>(null);
  
  // State for analysis results
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  
  // State for panorama gallery
  const [showPanoramaGallery, setShowPanoramaGallery] = useState(false);
  const [panoramaWithDates, setPanoramaWithDates] = useState<{lon: number, lat: number, date: string}[]>([]);
  const globalPanoLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
  const [selectedForAnalysis, setSelectedForAnalysis] = useState<Set<number>>(new Set());
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  
  // Critical error logging
  const [jsErrors, setJsErrors] = useState<string[]>([]);

  const runBatchAiAnalysis = async (resultsToAnalyze: any[]) => {
    const panoramaApiService = new PanoramaApiService(process.env.REACT_APP_MAPY_API_KEY || '');

    for (const result of resultsToAnalyze) {
      setAnalysisResults(prevResults =>
        prevResults.map(prevResult =>
          prevResult.id === result.id ? { ...prevResult, analysisStatus: 'analyzing' } : prevResult
        )
      );

      try {
        const panoImageResponse = await panoramaApiService.fetchPanoramaImage(
          result.coordinates[0],
          result.coordinates[1]
        );

        if (!panoImageResponse.success || !panoImageResponse.imageUrl) {
          throw new Error('Nepodařilo se načíst obrázek pro analýzu.');
        }

        const blob = await fetch(panoImageResponse.imageUrl).then(r => r.blob());
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const response = await fetch('/api/analyze-property', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: dataUrl,
            coordinates: result.coordinates
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'AI analýza selhala.');
        }

        const aiResult = await response.json();
        
        setAnalysisResults(prevResults =>
          prevResults.map(prevResult =>
            prevResult.id === result.id
              ? { ...prevResult, aiAnalysis: aiResult, analysisStatus: 'completed' }
              : prevResult
          )
        );

      } catch (error) {
        console.error(`Chyba při analýze nemovitosti ${result.id}:`, error);
        setAnalysisResults(prevResults =>
          prevResults.map(prevResult =>
            prevResult.id === result.id
              ? { ...prevResult, aiAnalysis: { error: (error as Error).message }, analysisStatus: 'failed' }
              : prevResult
          )
        );
      }
    }
  };

  // Claude AI analysis function
  const analyzePropertyCondition = async (imageUrl: string, coordinates: [number, number]) => {
    // Mock analysis for now - replace with actual Claude API call
    const mockAnalysis = {
      coordinates,
      condition: 'neglected',
      confidence: Math.random() * 0.5 + 0.5, // 50-100%
      issues: [
        'Damaged facade',
        'Broken windows',
        'Overgrown vegetation',
        'Poor maintenance'
      ],
      recommendation: 'High potential acquisition target',
      estimatedValue: Math.floor(Math.random() * 500000) + 100000
    };
    
    return new Promise(resolve => {
      setTimeout(() => resolve(mockAnalysis), 1000 + Math.random() * 2000);
    });
  };

  // --- JS Panorama SDK loader ---
  const panoramaSdkPromiseRef = useRef<Promise<void> | null>(null);
  const ensurePanoramaSDK = (): Promise<void> => {
    if (typeof window !== 'undefined' && (window as any).Panorama) {
      return Promise.resolve();
    }
    if (panoramaSdkPromiseRef.current) return panoramaSdkPromiseRef.current;
    panoramaSdkPromiseRef.current = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('mapy-panorama-sdk') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
        return;
      }
      const script = document.createElement('script');
      script.id = 'mapy-panorama-sdk';
      script.type = 'text/javascript';
      script.src = 'https://api.mapy.com/js/panorama/v1/panorama.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
    return panoramaSdkPromiseRef.current;
  };

  // Panorama existence check via JS Panorama SDK
  // 🚀 OPTIMIZED: Cache for panorama checks to avoid duplicate API calls
  const panoramaCache = useRef<Record<string, IPanoramaExistsOutput | null>>({});

  async function checkPanoramaExists(lon: number, lat: number, apiKey: string, radius: number = 150): Promise<IPanoramaExistsOutput | null> {
    // Quick validation without logging
    if (typeof lon !== 'number' || isNaN(lon) || typeof lat !== 'number' || isNaN(lat) || !apiKey) {
      return null;
    }

    // 🚀 Check cache first
    const cacheKey = `${lon.toFixed(6)},${lat.toFixed(6)},${radius}`;
    if (cacheKey in panoramaCache.current) {
      return panoramaCache.current[cacheKey];
    }

    try {
      await ensurePanoramaSDK();
      if (!(window as any).Panorama?.panoramaExists) {
        return null;
      }

      // 🚀 Add timeout to fail fast (300ms for instant results)
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 300)
      );

      const apiPromise = (window as any).Panorama.panoramaExists({ lon, lat, apiKey, radius });

      const output = await Promise.race([apiPromise, timeoutPromise]) as IPanoramaExistsOutput;

      // 🚀 Cache the result
      panoramaCache.current[cacheKey] = output;
      return output;
    } catch (e) {
      // 🚀 Cache failed attempts too
      panoramaCache.current[cacheKey] = null;
      return null;
    }
  }

  const rateLimiter = (() => {
    let last = 0;
    return () => new Promise<void>(r => {
      const now = Date.now();
      const wait = Math.max(0, 200 - (now - last));
      setTimeout(() => {
        last = Date.now();
        r();
      }, wait);
    });
  })();

  const seen = new Set<string>(); // globální deduplikace
  
  // COMPREHENSIVE FORCE RENDERING FUNCTION - Ensures all panorama features are visible
  const forceRenderPanoramaLayer = () => {
    console.log('🔄 Starting comprehensive panorama layer refresh...');
    
    if (!panoramaLayer || !mapInstanceRef.current) {
      console.warn('⚠️ Cannot force render - missing layer or map reference');
      return;
    }
    
    try {
      // Step 1: Force source refresh
      const source = panoramaLayer.getSource();
      if (source) {
        source.changed();
        console.log('✓ Source refresh triggered');
      }
      
      // Step 2: Force layer refresh
      panoramaLayer.changed();
      console.log('✓ Layer refresh triggered');
      
      // Step 3: Force map render
      mapInstanceRef.current.render();
      console.log('✓ Map render triggered');
      
      // Step 4: Delayed render for animation completion
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.render();
          console.log('✓ Delayed render completed');
        }
      }, 100);
      
      // Step 5: Force all layers refresh (in case of rendering conflicts)
      const mapLayers = mapInstanceRef.current.getLayers().getArray();
      mapLayers.forEach((layer) => {
        layer.changed();
        if ('getSource' in layer && typeof (layer as any).getSource === 'function') {
          (layer as any).getSource()?.changed();
        }
      });
      
      console.log('✅ Comprehensive panorama layer refresh completed');
      
    } catch (error) {
      console.error('❌ Error during force rendering:', error);
    }
  };

  // 🚀 OPTIMIZED: Point-in-polygon test using ray casting algorithm
  const pointInPolygon = (point: [number, number], polygon: [number, number][]): boolean => {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    // 🔍 DEBUG: Log result for some tests
    if (Math.random() < 0.1) {
      console.log(`🔶 Point-in-polygon result: ${inside}`);
    }
    
    return inside;
  };

  // Convert OpenLayers polygon to coordinate array - ENHANCED DEBUG VERSION
  const polygonToCoords = (polygon: Polygon): [number, number][] => {
    const coordinates = polygon.getCoordinates()[0]; // Get outer ring
    console.log('🔄 Coordinate Transformation Debug:');
    console.log('  📍 Raw polygon coordinates (projected):', coordinates.slice(0, 3), '... (showing first 3)');
    
    const lonLatCoords = coordinates.map((coord, index) => {
      const lonLat = toLonLat(coord) as [number, number];
      if (index < 3) { // Log first 3 coordinate transformations
        console.log(`  🔄 Transform ${index + 1}: [${coord[0].toFixed(2)}, ${coord[1].toFixed(2)}] -> [${lonLat[1].toFixed(6)}, ${lonLat[0].toFixed(6)}] (lat,lon)`);
      }
      return lonLat;
    });
    
    console.log(`  📍 Polygon bounds: ${lonLatCoords.length} vertices`);
    const lons = lonLatCoords.map(c => c[0]);
    const lats = lonLatCoords.map(c => c[1]);
    console.log(`  📍 Lon range: ${Math.min(...lons).toFixed(6)} to ${Math.max(...lons).toFixed(6)}`);
    console.log(`  📍 Lat range: ${Math.min(...lats).toFixed(6)} to ${Math.max(...lats).toFixed(6)}`);
    
    return lonLatCoords;
  };

  // Adaptive quadtree node class
  class QuadTreeNode {
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
    level: number;
    children: QuadTreeNode[] | null = null;
    points: { lon: number; lat: number; name: string }[] = [];
    maxPoints = 4;
    maxLevel = 6;

    constructor(bounds: { minX: number; minY: number; maxX: number; maxY: number }, level = 0) {
      this.bounds = bounds;
      this.level = level;
    }

    subdivide() {
      const { minX, minY, maxX, maxY } = this.bounds;
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;

      this.children = [
        new QuadTreeNode({ minX, minY, maxX: midX, maxY: midY }, this.level + 1), // SW
        new QuadTreeNode({ minX: midX, minY, maxX, maxY: midY }, this.level + 1), // SE
        new QuadTreeNode({ minX, minY: midY, maxX: midX, maxY }, this.level + 1), // NW
        new QuadTreeNode({ minX: midX, minY: midY, maxX, maxY }, this.level + 1)  // NE
      ];
    }

    insert(point: { lon: number; lat: number; name: string }) {
      const { lon, lat } = point;
      
      if (lon < this.bounds.minX || lon > this.bounds.maxX || 
          lat < this.bounds.minY || lat > this.bounds.maxY) {
        return false;
      }

      if (this.points.length < this.maxPoints && this.level < this.maxLevel) {
        this.points.push(point);
        return true;
      }

      if (this.children === null && this.level < this.maxLevel) {
        this.subdivide();
        
        // Redistribute existing points
        for (const existingPoint of this.points) {
          for (const child of this.children!) {
            if (child.insert(existingPoint)) break;
          }
        }
        this.points = [];
      }

      if (this.children) {
        for (const child of this.children) {
          if (child.insert(point)) return true;
        }
      }

      return false;
    }

    getTestPoints(): { lon: number; lat: number; name: string }[] {
      let allPoints: { lon: number; lat: number; name: string }[] = [];
      
      if (this.children === null) {
        // Leaf node - generate test points in this region
        const { minX, minY, maxX, maxY } = this.bounds;
        const density = Math.max(2, Math.min(6, 8 - this.level)); // Higher density for smaller regions
        
        for (let i = 0; i < density; i++) {
          for (let j = 0; j < density; j++) {
            const lon = minX + (maxX - minX) * (i + 0.5) / density;
            const lat = minY + (maxY - minY) * (j + 0.5) / density;
            allPoints.push({ 
              lon, 
              lat, 
              name: `L${this.level}_${i}_${j}` 
            });
          }
        }
      } else {
        // Internal node - collect from children
        for (const child of this.children) {
          allPoints = allPoints.concat(child.getTestPoints());
        }
      }
      
      return allPoints;
    }
  }

  // Generate a comprehensive grid of points inside polygon with fixed spacing
  const generateComprehensivePointsInPolygon = (
    polygonCoords: [number, number][],
    west: number,
    south: number,
    east: number,
    north: number,
    spacingMeters: number = 15,
    maxPoints: number = 3000
  ): Array<{ lon: number; lat: number }> => {
    const centerLat = (south + north) / 2;
    const metersPerDegLat = 111_000;
    const metersPerDegLon = 111_000 * Math.cos(centerLat * Math.PI / 180);

    // Calculate polygon area for adaptive density
    const widthMeters = Math.max(1, (east - west) * metersPerDegLon);
    const heightMeters = Math.max(1, (north - south) * metersPerDegLat);
    const areaMeters2 = widthMeters * heightMeters;
    
    const stepLon = spacingMeters / metersPerDegLon;
    const stepLat = spacingMeters / metersPerDegLat;

    console.log(`🔍 Generating comprehensive grid with ${spacingMeters}m spacing`);
    console.log(`🔍 Grid steps: lon=${stepLon.toFixed(6)}, lat=${stepLat.toFixed(6)}`);

    const grid: Array<{ lon: number; lat: number }> = [];
    let totalTested = 0;
    let totalInside = 0;

    // Generate grid points with point-in-polygon validation
    for (let lat = south + stepLat / 2; lat <= north; lat += stepLat) {
      for (let lon = west + stepLon / 2; lon <= east; lon += stepLon) {
        totalTested++;
        if (pointInPolygon([lon, lat], polygonCoords)) {
          totalInside++;
          grid.push({ lon, lat });
          if (grid.length >= maxPoints) {
            console.warn(`⚠️ Grid capped at ${maxPoints} points to protect performance`);
            return grid;
          }
        }
      }
    }

    console.log(`🔍 Grid generation complete: ${totalTested} points tested, ${totalInside} inside polygon`);
    console.log(`🔍 Final grid size: ${grid.length} points`);

    return grid;
  };

  // Add global error handler to catch JavaScript errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errorMsg = `JS Error: ${event.message} (${event.filename}:${event.lineno}:${event.colno})`;
      console.error('🚨 GLOBAL ERROR CAUGHT:', errorMsg);
      setJsErrors(prev => [...prev.slice(-9), errorMsg]); // Keep last 10 errors
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMsg = `Promise Rejection: ${event.reason}`;
      console.error('🚨 UNHANDLED PROMISE REJECTION:', errorMsg);
      setJsErrors(prev => [...prev.slice(-9), errorMsg]);
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || mountedRef.current) return;
      
      mountedRef.current = true; // Označíme jako mounted

      const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
      
      // Debug výpis pro kontrolu API klíče
      console.log('API_KEY loaded:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT FOUND');
      
      if (!API_KEY) {
        console.warn('API key not found, using OpenStreetMap fallback');
        // setError('API key not found in environment variables');
        // setIsLoading(false);
        // return;
      }

      try {
        // Mapy.cz základní dlaždice nebo OpenStreetMap fallback
        const mapUrl = API_KEY 
          ? `https://api.mapy.cz/v1/maptiles/basic/256/{z}/{x}/{y}.png?apiKey=${API_KEY}`
          : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        
        console.log('Using map URL:', mapUrl);
        
        const tileLayer = new TileLayer({
          source: new XYZ({
            url: mapUrl,
            attributions: API_KEY ? '© Mapy.cz' : '© OpenStreetMap contributors',
            crossOrigin: 'anonymous',
          }),
        });
        
        // Test the tile source by trying to load a sample tile
        const testUrl = mapUrl.replace('{z}', '10').replace('{x}', '550').replace('{y}', '350');
        console.log('Testing tile URL:', testUrl);
        
        fetch(testUrl, { method: 'HEAD' })
          .then(response => {
            console.log('Tile test response:', response.status, response.statusText);
            if (response.ok) {
              console.log('✅ Map tiles should load correctly');
            } else {
              console.warn('⚠️ Map tiles may not load - response:', response.status);
            }
          })
          .catch(error => {
            console.error('❌ Error testing map tiles:', error);
          });

        // Vytvoření vector source a layer pro kreslení polygonů
        const vectorSource = new VectorSource();
        vectorSourceRef.current = vectorSource;

        const vectorLayer = new VectorLayer({
          source: vectorSource,
          style: new Style({
            fill: new Fill({
              color: 'rgba(0, 212, 255, 0.2)', // Electric blue s průhledností
            }),
            stroke: new Stroke({
              color: '#00D4FF', // Electric blue
              width: 2,
            }),
          }),
        });
        vectorLayerRef.current = vectorLayer;

        // Vytvoření layer pro panorama body - ZOOM-INDEPENDENT VISIBILITY VERSION
        const panoramaSource = new VectorSource();
        
        // Dynamic style function that adapts to zoom level
        const createPanoramaStyle = (feature: any, resolution: number) => {
          // Calculate zoom level from resolution
          const zoom = Math.round(Math.log2(156543.04 / resolution));
          
          // Scale circle size based on zoom level for optimal visibility
          let radius: number;
          if (zoom <= 10) {
            radius = 8;  // Smaller at low zoom for overview
          } else if (zoom <= 15) {
            radius = 12; // Medium at mid zoom
          } else {
            radius = 16; // Larger at high zoom for detail
          }
          
          return new Style({
            image: new CircleStyle({
              radius: radius,
              fill: new Fill({ color: 'rgba(255, 0, 0, 1.0)' }), // FULL OPACITY RED
              stroke: new Stroke({ 
                color: '#ffffff', 
                width: 3, // Consistent border width
                lineDash: undefined
              }),
            }),
          });
        };
        
        const panoramaVectorLayer = new VectorLayer({
          source: panoramaSource,
          visible: true, // EXPLICITLY VISIBLE
          zIndex: 3000, // MAXIMUM Z-INDEX to ensure visibility above everything
          minZoom: 0,  // ALWAYS VISIBLE - no minimum zoom constraint
          maxZoom: 30, // ALWAYS VISIBLE - no maximum zoom constraint
          renderBuffer: 1000, // Large render buffer to prevent culling
          updateWhileAnimating: true, // Keep updating during zoom animations
          updateWhileInteracting: true, // Keep updating during interactions
          style: createPanoramaStyle, // Use dynamic style function
          declutter: false, // Never declutter/hide overlapping features
        });
        
        // 🔍 LAYER DEBUG INFO
        console.log('🔴 Panorama Layer Creation Debug:');
        console.log('  📶 Layer visible:', panoramaVectorLayer.getVisible());
        console.log('  📏 Layer z-index:', panoramaVectorLayer.getZIndex());
        console.log('  🎨 Layer style:', panoramaVectorLayer.getStyle());
        console.log('  📎 Source features count:', panoramaSource.getFeatures().length);
        
        setPanoramaLayer(panoramaVectorLayer);
        console.log('✅ Panorama layer created and stored in state');

        // Vytvoření globálního layer pro všechny panorama body v ČR
        const globalPanoSource = new VectorSource();
        const globalPanoLayer = new VectorLayer({
          source: globalPanoSource,
          visible: false,
          zIndex: 900,
          style: new Style({
            image: new CircleStyle({
              radius: 4,
              fill: new Fill({ color: '#ff5252' }),
              stroke: new Stroke({ color: '#ffffff', width: 1 }),
            }),
          }),
        });
        globalPanoLayerRef.current = globalPanoLayer;

        console.log('Created panorama layer with source:', panoramaSource);
        console.log('Panorama layer style:', panoramaVectorLayer.getStyle());

        // Vytvoření optimalizovaných interakcí pro macOS gesta
        const interactions = defaultInteractions({
          pinchZoom: false, // Vypneme defaultní pinch zoom
          mouseWheelZoom: false, // Vypneme defaultní mouse wheel zoom
          doubleClickZoom: false, // Vypneme double-click zoom, aby neintefoval s kreslením
        }).extend([
          // Přidáme vylepšený PinchZoom pro macOS trackpad gesta
          new PinchZoom({
            duration: 300, // Plynulejší animace
          }),
          // Vylepšený MouseWheelZoom pro smooth scrolling na macOS
          new MouseWheelZoom({
            duration: 300, // Plynulejší animace
            timeout: 80, // Kratší timeout pro responzivnější zoom
            useAnchor: true, // Zoom k pozici kurzoru
          }),
          // Zachováme ostatní základní interakce
          new DragPan(),
          new KeyboardZoom(),
          new DragZoom(),
        ]);

        // Create map centered on Prague, Czech Republic
        const map = new Map({
          target: mapRef.current,
          layers: [
            tileLayer,           // Base map tiles (z-index: default)
            globalPanoLayer,     // Global panorama layer (z-index: 900)
            vectorLayer,         // Polygon drawing layer (z-index: default)
            panoramaVectorLayer  // Local panorama layer (z-index: 3000) - HIGHEST PRIORITY
          ],
          interactions: interactions, // Používáme naše optimalizované interakce
          view: new View({
            center: fromLonLat([14.4378, 50.0755]), // Praha - centrum města kde určitě jsou panoramy
            zoom: 16,
            // Nastavení pro plynulejší zoom
            smoothResolutionConstraint: true,
            smoothExtentConstraint: true,
          }),
        });
        
        // 🔍 VERIFY MAP LAYER SETUP
        console.log('🗺️ Map Layer Setup Verification:');
        const mapLayers = map.getLayers().getArray();
        mapLayers.forEach((layer, index) => {
          const layerType = layer.constructor.name;
          const zIndex = layer.getZIndex();
          const visible = layer.getVisible();
          console.log(`🗺️ Layer ${index}: ${layerType}, z-index: ${zIndex}, visible: ${visible}`);
          
          if (layer === panoramaVectorLayer) {
            console.log(`✅ PANORAMA LAYER FOUND at index ${index}`);
          }
        });

        console.log('Map created with layers:', map.getLayers().getLength());
        console.log('Panorama layer is in map:', map.getLayers().getArray().includes(panoramaVectorLayer));
        console.log('Panorama layer source feature count:', panoramaSource.getFeatures().length);
        
        // Add view change listener to ensure panorama visibility during zoom operations
        const view = map.getView();
        let zoomChangeTimeout: NodeJS.Timeout | null = null;
        
        view.on('change:resolution', () => {
          // Clear existing timeout
          if (zoomChangeTimeout) {
            clearTimeout(zoomChangeTimeout);
          }
          
          // Set a debounced timeout to refresh panorama layer after zoom stabilizes
          zoomChangeTimeout = setTimeout(() => {
            console.log('🔄 Zoom level changed, refreshing panorama layer...');
            forceRenderPanoramaLayer();
          }, 150); // 150ms debounce to avoid excessive refreshes during smooth zoom
        });

        // Vytvoření Draw interakce pro kreslení polygonů
        const drawInteraction = new Draw({
          source: vectorSource,
          type: 'Polygon',
          // Standardní chování: kliknutí na první bod pro uzavření, double-click kdekoli pro ukončení
          style: new Style({
            fill: new Fill({
              color: 'rgba(0, 212, 255, 0.1)',
            }),
            stroke: new Stroke({
              color: '#00D4FF',
              width: 2,
              lineDash: [5, 5], // Čárkovaná čára během kreslení
            }),
          }),
        });
        drawInteractionRef.current = drawInteraction;

        // Vytvoření Modify interakce pro úpravu polygonů
        const modifyInteraction = new Modify({
          source: vectorSource,
        });
        modifyInteractionRef.current = modifyInteraction;

        // Přidání modify interakce (vždy aktivní pro úpravu existujících polygonů)
        map.addInteraction(modifyInteraction);

        // Click handler pro panorama body - zobrazí info
        map.on('click', (event) => {
          const features = map.getFeaturesAtPixel(event.pixel);
          if (features && features.length > 0) {
            const feature = features[0];
            const name = feature.get('name');
            const coords = feature.get('coordinates');
            const date = feature.get('date');
            const type = feature.get('type');
            
            if (name && coords) {
              console.log(`🔍 Clicked on panorama: ${name}`);
              console.log(`📍 Coordinates: [${coords[1]}, ${coords[0]}]`);
              if (date) console.log(`📅 Date: ${date}`);
              
              // Ukáž alert s info
              const info = type === 'mock' 
                ? `🤖 Mock Panorama: ${name}\n📍 Coordinates: [${coords[1]}, ${coords[0]}]`
                : `📷 Real Panorama: ${name}\n📍 Coordinates: [${coords[1]}, ${coords[0]}]\n📅 Date: ${date}`;
              
              alert(info);
            }
          }
        });

        // Event listener pro dokončení kreslení
        drawInteraction.on('drawend', async (event) => {
          console.log('🎯 DRAW ENDED - AUTOMATIC PANORAMA SEARCH STARTING!');
          console.log('Event:', event);
          console.log('Setting hasPolygon to TRUE');
          setHasPolygon(true);
          setIsDrawingMode(false);
          map.removeInteraction(drawInteraction);
          
          // Ihned po dokončení polygonu začneme hledat panorama body
          const polygon = event.feature.getGeometry() as Polygon;
          console.log('🚀 STARTING AUTOMATIC PANORAMA SEARCH FOR NEW POLYGON...');
          console.log('Polygon:', polygon);
          console.log('Polygon extent:', polygon.getExtent());
          
          // POČKÁME na inicializaci panorama layer
          console.log('⏳ Waiting for panorama layer to be ready...');
          let attempts = 0;
          const maxAttempts = 50; // 5 sekund max
          
          while (!panoramaLayer && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
            console.log(`⏳ Attempt ${attempts}/${maxAttempts} - panoramaLayer: ${!!panoramaLayer}`);
          }
          
          if (!panoramaLayer) {
            console.error('❌ Panorama layer not ready after waiting - using fallback');
            // Fallback: použijeme přímo panoramaVectorLayer z aktuálního scope
            const fallbackSource = panoramaVectorLayer.getSource();
            if (fallbackSource) {
              console.log('✅ Using fallback panorama source');
              // Dočasně nastavíme panoramaLayer pro findPanoramas
              const originalPanoramaLayer = panoramaLayer;
              setPanoramaLayer(panoramaVectorLayer);
              // Počkáme na state update
              await new Promise(resolve => setTimeout(resolve, 50));
              try {
                await findPanoramas(polygon);
                console.log('✅ Automatic panorama search completed successfully with fallback!');
              } catch (error) {
                console.error('❌ Error in automatic panorama search with fallback:', error);
              } finally {
                // Obnovíme původní state
                setPanoramaLayer(originalPanoramaLayer);
              }
            } else {
              console.error('❌ Fallback panorama source also not available');
            }
          } else {
            console.log('✅ Panorama layer is ready, proceeding with search');
            // GARANTUJEME spuštění
            try {
              await findPanoramas(polygon);
              console.log('✅ Automatic panorama search completed successfully!');
            } catch (error) {
              console.error('❌ Error in automatic panorama search:', error);
            }
          }
        });

        // Debug event listenery
        drawInteraction.on('drawstart', (event) => {
          console.log('Draw started!', event);
        });

        drawInteraction.on('drawabort', (event) => {
          console.log('Draw aborted!', event);
        });

        // Event listener pro změnu v vector source (mazání polygonů)
        vectorSource.on('changefeature', () => {
          setHasPolygon(vectorSource.getFeatures().length > 0);
        });

        vectorSource.on('clear', () => {
          setHasPolygon(false);
        });

        // Přidáme speciální event listenery pro macOS trackpad gesta
        const mapElement = mapRef.current;
        
        // Vylepšená podpora pro trackpad zoom gesta na macOS
        const handleWheel = (event: WheelEvent) => {
          // Detekce pinch-to-zoom gesta (ctrlKey indikuje pinch gesto na macOS)
          if (event.ctrlKey) {
            event.preventDefault();
            
            const view = map.getView();
            const currentZoom = view.getZoom() || 16;
            
            // Výpočet nového zoom levelu na základě delta
            const delta = event.deltaY;
            const zoomDelta = delta > 0 ? -0.1 : 0.1; // Jemnější kroky zoomu
            const newZoom = Math.max(1, Math.min(20, currentZoom + zoomDelta));
            
            // Plynulý zoom k pozici kurzoru
            view.animate({
              zoom: newZoom,
              duration: 100, // Rychlá odezva
            });
          }
        };

        // Uložíme handler do ref pro cleanup
        wheelHandlerRef.current = handleWheel;

        // Přidáme event listener pro wheel events
        mapElement.addEventListener('wheel', handleWheel, { passive: false });

        // Event listener pro klávesy (Escape pro zrušení kreslení)
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape' && isDrawingMode) {
            setIsDrawingMode(false);
            map.removeInteraction(drawInteraction);
          }
        };

        keyHandlerRef.current = handleKeyDown;
        document.addEventListener('keydown', handleKeyDown);

        // Žádné logo control není potřeba pro OpenStreetMap

        mapInstanceRef.current = map;
        setIsLoading(false);
        console.log('Map initialized successfully with OpenLayers, Mapy.cz tiles and macOS gestures');
        
        // AUTOMATICKÝ TEST BOT - spustí se po 2 sekundách
        setTimeout(() => {
          console.log('🚀 Auto-starting Test Bot in 3 seconds...');
          setTimeout(() => {
            console.log('🤖 Auto Test Bot - Adding sample panorama points for demo');
            // Nespouštíme automaticky, necháme uživatele kliknout
          }, 3000);
        }, 2000);

      } catch (err) {
        console.error('Map initialization failed:', err);
        setError(`Map initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initMap, 100);

    return () => {
      clearTimeout(timer);
      mountedRef.current = false; // Reset pro případný re-mount
      
      // Uložíme reference pro cleanup
      const currentMapRef = mapRef.current;
      const currentWheelHandler = wheelHandlerRef.current;
      const currentKeyHandler = keyHandlerRef.current;
      
      if (mapInstanceRef.current) {
        // Odstranění event listeneru před zničením mapy
        if (currentMapRef && currentWheelHandler) {
          currentMapRef.removeEventListener('wheel', currentWheelHandler);
        }
        
        // Odstranění keyboard event listeneru
        if (currentKeyHandler) {
          document.removeEventListener('keydown', currentKeyHandler);
        }
        
        mapInstanceRef.current.setTarget(undefined);
        mapInstanceRef.current = null;
        wheelHandlerRef.current = null;
        keyHandlerRef.current = null;
      }
    };
  }, []); // Prázdná dependency array je správná - chceme inicializovat mapu jen jednou

  const handleDrawArea = () => {
    console.log('handleDrawArea called');
    console.log('mapInstanceRef.current:', mapInstanceRef.current);
    console.log('drawInteractionRef.current:', drawInteractionRef.current);
    console.log('isDrawingMode:', isDrawingMode);
    
    if (!mapInstanceRef.current || !drawInteractionRef.current) {
      console.log('Missing map or draw interaction!');
      return;
    }
    
    const map = mapInstanceRef.current;
    const drawInteraction = drawInteractionRef.current;
    
    if (isDrawingMode) {
      // Vypnout drawing mode
      console.log('Turning OFF drawing mode');
      map.removeInteraction(drawInteraction);
      setIsDrawingMode(false);
    } else {
      // Zapnout drawing mode
      console.log('Turning ON drawing mode');
      
      // Nejprve vyčistíme existující polygony a panorama body
      if (vectorSourceRef.current) {
        vectorSourceRef.current.clear();
        setHasPolygon(false);
      }
      
      if (panoramaLayer) {
        panoramaLayer.getSource()?.clear();
        setPanoramaLocations([]);
    setPanoramaWithDates([]);
      }
      
      map.addInteraction(drawInteraction);
      setIsDrawingMode(true);
      console.log('Drawing mode activated');
    }
  };



  // Funkce findPanoramas() - ADAPTIVNÍ QUADTREE VYHLEDÁVÁNÍ
  async function findPanoramas(poly: Polygon) {
    console.log('🚀🚀🚀 ADAPTIVE QUADTREE PANORAMA SEARCH STARTED! 🚀🚀🚀');
    console.log('Function called with polygon:', poly);
    
    const source = panoramaLayer?.getSource();
    if (!source) {
      console.error('❌ Panorama layer source not available');
      return;
    }
    
    console.log('✅ Panorama layer source is available');
    
    // Vyčisti vše
    source.clear();
    seen.clear();
    console.log('✅ Cleared previous panorama points');
    
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    setPanoramaLocations([]);
    setPanoramaWithDates([]);
    console.log('✅ Set analyzing state to true');

    try {
      // Získej hranice polygonu a převeď na souřadnice
      const extent = poly.getExtent();
      const [w, s] = toLonLat([extent[0], extent[1]]);
      const [e, n] = toLonLat([extent[2], extent[3]]);
      
      console.log(`📐 Polygon bounds: W=${w.toFixed(6)} S=${s.toFixed(6)} E=${e.toFixed(6)} N=${n.toFixed(6)}`);
      
      // Převeď polygon na pole souřadnic pro point-in-polygon test
      const polygonCoords = polygonToCoords(poly);
      console.log(`🔷 Polygon has ${polygonCoords.length} vertices`);
      
      const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
      if (!API_KEY) {
        console.warn('No API key available; skipping panorama search. Configure REACT_APP_MAPY_API_KEY.');
        alert('Panorama detection requires REACT_APP_MAPY_API_KEY. Please set it in .env.local and restart the app.');
        setIsAnalyzing(false);
        setAnalysisProgress(0);
        return;
      }
      
      setAnalysisProgress(20);
      
      // Comprehensive grid covering entire polygon area (fixed 15m spacing)
      const gridPoints = generateComprehensivePointsInPolygon(
        polygonCoords,
        w, s, e, n,
        15,
        4000
      );
      
      console.log(`🎯 Generated ${gridPoints.length} comprehensive test points covering entire polygon area`);
      setAnalysisProgress(30);
      
      let foundCount = 0;
      const newResults: any[] = [];
      const foundPanoramas: {lon: number, lat: number, info?: any}[] = [];
      const allPanoramaLocations: {lon: number, lat: number}[] = [];
      const allPanoramaWithDates: {lon: number, lat: number, date: string}[] = [];
      const allFeatures: Feature[] = []; // 🚀 Collect all features for batch add

      console.log(`🎯 Testing ${gridPoints.length} comprehensive grid points for panoramas...`);
      
      // Test each point in the comprehensive grid for panorama existence
      console.log(`🔍 Starting comprehensive panorama search with ${gridPoints.length} test points...`);

      // 🚀 ULTRA-FAST: Process ALL points simultaneously - no batching!
      const searchRadius = 25;

      console.log(`🚀 Processing ALL ${gridPoints.length} points at once...`);
      setAnalysisProgress(40);

      // Fire all requests at once
      const allResults = await Promise.allSettled(
        gridPoints.map((point, idx) =>
          checkPanoramaExists(point.lon, point.lat, API_KEY, searchRadius)
            .then(result => ({ point, result, index: idx }))
        )
      );

      console.log(`✅ All ${gridPoints.length} API calls completed!`);
      setAnalysisProgress(70);

      // Process all results
      for (const promiseResult of allResults) {
        if (promiseResult.status === 'rejected') continue;

        const { point, result: panoramaResult, index: i } = promiseResult.value;

          try {

          // 🚀 OPTIMIZED: Quick validation without verbose logging
          if (!panoramaResult?.exists || !panoramaResult.info) continue;

          const { lon, lat } = panoramaResult.info;
          if (typeof lon !== 'number' || typeof lat !== 'number' ||
              lon < -180 || lon > 180 || lat < -90 || lat > 90) continue;

          // Process valid panorama
          if (panoramaResult.exists && panoramaResult.info) {
            // Quick polygon check
            if (!pointInPolygon([panoramaResult.info.lon, panoramaResult.info.lat], polygonCoords)) {
              continue;
            }

            // Quick deduplication
            const key = `${panoramaResult.info.lat.toFixed(6)}_${panoramaResult.info.lon.toFixed(6)}`;
            if (seen.has(key)) continue;
            seen.add(key);

            foundCount++;
            
            // Quick spatial deduplication
            const isTooClose = foundPanoramas.some(existing => {
              const dLon = panoramaResult.info!.lon - existing.lon;
              const dLat = panoramaResult.info!.lat - existing.lat;
              return (dLon * dLon + dLat * dLat) < 0.00000001; // ~10 meters
            });
            if (isTooClose) continue;
            
            foundPanoramas.push({
              lon: panoramaResult.info.lon,
              lat: panoramaResult.info.lat,
              info: panoramaResult.info
            });

            // 🚀 NO AWAIT - create feature immediately without AI analysis
            const originalCoords = [panoramaResult.info.lon, panoramaResult.info.lat];
            const projectedCoords = fromLonLat(originalCoords);

            // Create mock analysis for instant rendering
            const mockAnalysis = {
              condition: 'pending',
              confidence: 0,
              issues: ['Analysis pending...'],
              recommendation: 'AI analysis will run in background',
              estimatedValue: 0
            };

            const panoramaFeature = new Feature({
              geometry: new Point(projectedCoords),
              name: `Panorama ${foundCount}`,
              coordinates: originalCoords,
              date: panoramaResult.info.date || '2024-01-01 12:00:00',
              type: 'real-panorama',
              analysis: mockAnalysis,
              panoramaInfo: panoramaResult.info
            });

            // 🚀 Collect feature for batch add (no progressive rendering!)
            allFeatures.push(panoramaFeature);

            // Přidej do výsledků
            newResults.push({
              id: foundCount,
              name: `Panorama ${foundCount}`,
              coordinates: [panoramaResult.info.lon, panoramaResult.info.lat],
              condition: mockAnalysis.condition,
              confidence: mockAnalysis.confidence,
              issues: mockAnalysis.issues,
              recommendation: mockAnalysis.recommendation,
              estimatedValue: mockAnalysis.estimatedValue,
              panoramaDate: panoramaResult.info.date,
              analysisStatus: 'pending'
            });

            // 🚀 Collect for batch state update at the end
            allPanoramaLocations.push({ lon: panoramaResult.info.lon, lat: panoramaResult.info.lat });
            allPanoramaWithDates.push({
              lon: panoramaResult.info.lon,
              lat: panoramaResult.info.lat,
              date: panoramaResult.info.date
            });
          }
        } catch (error) {
          // Continue with next point rather than failing completely
        }
      }

      // 🚀 INSTANT UPDATE: Add all features to map at once!
      console.log(`🚀 Adding ${allFeatures.length} features to map instantly...`);
      if (allFeatures.length > 0) {
        source.addFeatures(allFeatures); // Batch add - single render!
      }

      // 🚀 INSTANT UPDATE: Set all state at once - no progressive rendering!
      console.log(`🚀 Updating state with ${allPanoramaLocations.length} panoramas...`);
      setPanoramaLocations(allPanoramaLocations);
      setPanoramaWithDates(allPanoramaWithDates);
      setAnalysisResults(newResults);

      // Spustíme AI analýzu na pozadí pro všechny nové výsledky
      runBatchAiAnalysis(newResults);

      // Show analysis panel if we have results
      if (newResults.length > 0) {
        setShowAnalysisPanel(true);
      }
      
      // Enhanced completion logging
      console.log(`🏁🏁🏁 COMPREHENSIVE SEARCH COMPLETED! 🏁🏁🏁`);
      console.log(`📊 Search Statistics:`);
      console.log(`  • Total grid points tested: ${gridPoints.length}`);
      console.log(`  • Panoramas found: ${foundCount}`);
      console.log(`  • Unique panoramas after deduplication: ${foundPanoramas.length}`);
      console.log(`  • Analysis results: ${newResults.length}`);
      console.log(`  • Polygon area coverage: Complete`);
      
      setAnalysisProgress(95);
      
      // 🔄 COMPREHENSIVE MAP REFRESH AND LAYER VERIFICATION
      console.log('🔄 FORCING complete map refresh...');
      
      // Verify layer is still in the map
      if (mapInstanceRef.current && panoramaLayer) {
        const mapLayers = mapInstanceRef.current.getLayers().getArray();
        const panoramaLayerInMap = mapLayers.includes(panoramaLayer);
        console.log(`🗺️ Panorama layer is in map: ${panoramaLayerInMap}`);
        console.log(`🗺️ Total map layers: ${mapLayers.length}`);
        console.log(`🗺️ Panorama layer z-index: ${panoramaLayer.getZIndex()}`);
        console.log(`🗺️ Panorama layer visible: ${panoramaLayer.getVisible()}`);
        
        if (!panoramaLayerInMap) {
          console.warn('⚠️ Panorama layer not found in map! Re-adding...');
          mapInstanceRef.current.addLayer(panoramaLayer);
        }
        
        // Use centralized force rendering function
        forceRenderPanoramaLayer();
      }
      
      setAnalysisProgress(100);
      
      console.log(`🎉🎉🎉 SEARCH COMPLETE! 🎉🎉🎉`);
      console.log(`📊 Created ${foundCount} panorama points`);
      console.log(`📊 Total features in panorama layer: ${source.getFeatures().length}`);
      console.log(`📍 PanoramaLocations state length: ${panoramaLocations.length}`);
      
      // Extra debug - list all features
      const features = source.getFeatures();
      console.log(`🔴 All features in layer:`);
      features.forEach((feature, index) => {
        const coords = feature.get('coordinates');
        const name = feature.get('name');
        console.log(`🔴 Feature ${index + 1}: ${name} at [${coords[1]}, ${coords[0]}]`);
      });
      
      if (foundCount > 0) {
        console.log(`✅✅✅ SUCCESS! You should see ${foundCount} RED DOTS on the map! ✅✅✅`);
      }
      
    } catch (error) {
      console.error('❌❌❌ ERROR in findPanoramas:', error);
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      setError('Failed to search for panoramas');
      
      // Enhanced user-friendly error alert with specific guidance
      const errorMessage = error instanceof Error ? error.message : String(error);
      let userGuidance = '';
      
      if (errorMessage.includes('API') || errorMessage.includes('key')) {
        userGuidance = 'Check your REACT_APP_MAPY_API_KEY in .env.local file';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userGuidance = 'Check your internet connection and try again';
      } else if (errorMessage.includes('polygon') || errorMessage.includes('geometry')) {
        userGuidance = 'Try drawing a smaller polygon area';
      } else {
        userGuidance = 'Check browser console for detailed error information';
      }
      
      alert(
        `❌ PANORAMA SEARCH FAILED\n\n` +
        `Error: ${errorMessage}\n\n` +
        `🔧 Troubleshooting:\n` +
        `• ${userGuidance}\n` +
        `• Ensure polygon is properly drawn\n` +
        `• Try smaller search area\n` +
        `• Check API key configuration\n\n` +
        `💡 Tip: Use DEBUG TEST button to verify system functionality.`
      );
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(100);
      console.log('🏁 findPanoramas function completed');
    }
  }

  const handleToggleAnalysisSelection = (id: number) => {
    setSelectedForAnalysis(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      return newSelection;
    });
  };

  const handleRunAiAnalysis = async () => {
    if (selectedForAnalysis.size === 0) {
      alert('Vyberte prosím alespoň jednu nemovitost k analýze.');
      return;
    }

    setIsAiAnalyzing(true);
    const selectedResults = analysisResults.filter(r => selectedForAnalysis.has(r.id));

    const panoramaApiService = new PanoramaApiService(process.env.REACT_APP_MAPY_API_KEY || '');

    for (const result of selectedResults) {
      try {
        // Fetch the panorama image as a blob URL
        const panoImageResponse = await panoramaApiService.fetchPanoramaImage(
          result.coordinates[0],
          result.coordinates[1]
        );

        if (!panoImageResponse.success || !panoImageResponse.imageUrl) {
          throw new Error('Nepodařilo se načíst obrázek pro analýzu.');
        }

        const blob = await fetch(panoImageResponse.imageUrl).then(r => r.blob());
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const response = await fetch('/api/analyze-property', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: dataUrl,
            coordinates: result.coordinates
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'AI analýza selhala.');
        }

        const aiResult = await response.json();
        
        // Update the specific result in the main analysisResults state
        setAnalysisResults(prevResults =>
          prevResults.map(prevResult =>
            prevResult.id === result.id
              ? { ...prevResult, aiAnalysis: aiResult }
              : prevResult
          )
        );

      } catch (error) {
        console.error(`Chyba při analýze nemovitosti ${result.id}:`, error);
        // Optionally update the result with an error message
        setAnalysisResults(prevResults =>
          prevResults.map(prevResult =>
            prevResult.id === result.id
              ? { ...prevResult, aiAnalysis: { error: (error as Error).message } }
              : prevResult
          )
        );
      }
    }

    setIsAiAnalyzing(false);
    alert(`AI analýza dokončena pro ${selectedResults.length} nemovitostí.`);
  };

  // COMPREHENSIVE API VALIDATION TEST
  const testApiConnection = async () => {
    console.log('🔗🔗🔗 COMPREHENSIVE API CONNECTION TEST 🔗🔗🔗');
    
    const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
    console.log('API Key availability:', !!API_KEY, API_KEY ? `(length: ${API_KEY.length})` : '');
    
    if (!API_KEY) {
      alert('❌ API KEY MISSING\n\nNo REACT_APP_MAPY_API_KEY found in environment.\nPlease set it in .env.local file and restart the application.');
      return;
    }
    
    // Test with a known Prague location that DEFINITELY has panoramas
    const testLocation = { lon: 14.4212, lat: 50.0875, name: 'Old Town Square, Prague' };
    console.log('Testing with known location:', testLocation.name);
    
    try {
      console.log('📡 Making test API call...');
      const result = await checkPanoramaExists(testLocation.lon, testLocation.lat, API_KEY, 200);
      
      console.log('🔍 API Test Result Analysis:');
      console.log('  Result exists:', !!result);
      console.log('  Result content:', result);
      
      if (result === null) {
        alert('❌ API CONNECTION FAILED\n\nThe API call returned null.\nCheck the browser console for detailed error information.\n\nPossible issues:\n• Invalid API key\n• Network connectivity\n• CORS policy\n• API service down');
        return;
      }
      
      if (result.exists === true && result.info) {
        alert(`✅ API CONNECTION SUCCESSFUL!\n\n🎯 Found panorama at ${testLocation.name}\n📍 Location: [${result.info.lat.toFixed(6)}, ${result.info.lon.toFixed(6)}]\n📅 Date: ${result.info.date}\n\n✅ The API is working correctly!\nIf panorama points still don't show, the issue is with layer visualization.`);
      } else if (result.exists === false) {
        alert(`⚠️ API WORKS BUT NO PANORAMA FOUND\n\nAPI response: exists = false\nLocation: ${testLocation.name}\n\n🤔 This is unexpected for this famous Prague location.\nTry a different location or check API service status.`);
      } else {
        alert(`❓ UNUSUAL API RESPONSE\n\nResponse structure: ${JSON.stringify(result, null, 2)}\n\nThe API returned an unexpected format.\nCheck browser console for details.`);
      }
      
    } catch (error) {
      console.error('🔥 API connection test failed:', error);
      alert(`❌ API CONNECTION TEST FAILED\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nCheck browser console for detailed error information.`);
    }
  };

  // LAYER SYSTEM DIAGNOSTIC
  const diagnosePanoramaLayer = () => {
    console.log('🔬🔬🔬 PANORAMA LAYER DIAGNOSTIC 🔬🔬🔬');
    
    // Check panoramaLayer state
    console.log('1. PanoramaLayer State Check:');
    console.log('  panoramaLayer exists:', !!panoramaLayer);
    console.log('  panoramaLayer reference:', panoramaLayer);
    
    if (!panoramaLayer) {
      alert('❌ CRITICAL: panoramaLayer is null!\n\nThe panorama layer was not created during map initialization.\nCheck map initialization code for errors.');
      return;
    }
    
    // Check layer properties
    console.log('2. Layer Properties:');
    console.log('  Layer visible:', panoramaLayer.getVisible());
    console.log('  Layer z-index:', panoramaLayer.getZIndex());
    console.log('  Layer opacity:', panoramaLayer.getOpacity());
    const layerStyle = panoramaLayer.getStyle();
    console.log('  Layer style:', layerStyle);
    console.log('  Layer constructor:', panoramaLayer.constructor.name);
    
    // Check source
    const source = panoramaLayer.getSource();
    console.log('3. Source Properties:');
    console.log('  Source exists:', !!source);
    console.log('  Source constructor:', source?.constructor.name);
    console.log('  Features count:', source?.getFeatures().length || 0);
    
    // Check map integration
    console.log('4. Map Integration:');
    if (mapInstanceRef.current) {
      const mapLayers = mapInstanceRef.current.getLayers().getArray();
      const panoramaLayerIndex = mapLayers.indexOf(panoramaLayer);
      console.log('  Layer in map:', panoramaLayerIndex !== -1);
      console.log('  Layer index:', panoramaLayerIndex);
      console.log('  Total map layers:', mapLayers.length);
      
      console.log('5. All Map Layers:');
      mapLayers.forEach((layer, index) => {
        console.log(`  Layer ${index}: ${layer.constructor.name}, visible: ${layer.getVisible()}, z-index: ${layer.getZIndex()}`);
      });
    }
    
    // Create comprehensive diagnostic report
    let diagnosticReport = '🔬 PANORAMA LAYER DIAGNOSTIC REPORT\n\n';
    
    if (!panoramaLayer) {
      diagnosticReport += '❌ CRITICAL: Layer not created\n';
    } else {
      diagnosticReport += '✅ Layer exists\n';
      diagnosticReport += `📊 Visible: ${panoramaLayer.getVisible()}\n`;
      diagnosticReport += `📊 Z-Index: ${panoramaLayer.getZIndex()}\n`;
      diagnosticReport += `📊 Features: ${source?.getFeatures().length || 0}\n`;
      
      if (mapInstanceRef.current) {
        const mapLayers = mapInstanceRef.current.getLayers().getArray();
        const inMap = mapLayers.includes(panoramaLayer);
        diagnosticReport += `📊 In Map: ${inMap}\n`;
        
        if (!inMap) {
          diagnosticReport += '\n❌ PROBLEM: Layer not in map!\n';
        } else if (!panoramaLayer.getVisible()) {
          diagnosticReport += '\n❌ PROBLEM: Layer not visible!\n';
        } else if ((panoramaLayer.getZIndex() || 0) < 1000) {
          diagnosticReport += '\n⚠️ WARNING: Low z-index - may be hidden behind other layers\n';
        } else if ((source?.getFeatures().length || 0) === 0) {
          diagnosticReport += '\n⚠️ INFO: No features in layer - add test points to verify visibility\n';
        } else {
          diagnosticReport += '\n✅ Layer appears to be configured correctly!\n';
        }
      }
    }
    
    diagnosticReport += '\n🔧 NEXT STEPS:\n';
    diagnosticReport += '1. Use DEBUG TEST to add a test point\n';
    diagnosticReport += '2. Check if you can see red circle on map\n';
    diagnosticReport += '3. If no, check layer style configuration\n';
    diagnosticReport += '4. If yes, the issue is with API data\n';
    
    alert(diagnosticReport);
    console.log('🔬 Diagnostic complete - check alert for report');
  };

  // PRAGUE PANORAMA LOCATION TESTER - Tests known panorama coordinates
  const testKnownPragueLocations = async () => {
    console.log('🏰 PRAGUE PANORAMA LOCATION TESTER STARTED!');
    
    const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
    if (!API_KEY) {
      console.error('❌ No API key available for Prague location test');
      alert('API key required for Prague panorama location test!');
      return;
    }
    
    const source = panoramaLayer?.getSource();
    if (!source) {
      console.error('❌ Panorama layer source not available');
      return;
    }
    
    // Known Prague locations where panoramas should exist
    const pragueTestLocations = [
      { name: 'Prague Castle', lon: 14.4001, lat: 50.0909 },
      { name: 'Old Town Square', lon: 14.4212, lat: 50.0875 },
      { name: 'Charles Bridge', lon: 14.4118, lat: 50.0863 },
      { name: 'Wenceslas Square', lon: 14.4281, lat: 50.0813 },
      { name: 'Prague Center', lon: 14.4378, lat: 50.0755 }
    ];
    
    console.log(`📍 Testing ${pragueTestLocations.length} known Prague locations...`);
    
    // Clear previous features
    source.clear();
    setPanoramaLocations([]);
    setPanoramaWithDates([]);
    
    for (let i = 0; i < pragueTestLocations.length; i++) {
      const location = pragueTestLocations[i];
      console.log(`📍 Testing ${location.name}: [${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}]`);
      
      try {
        const panoramaResult = await checkPanoramaExists(location.lon, location.lat, API_KEY, 200);
        
        if (panoramaResult && panoramaResult.exists && panoramaResult.info) {
          console.log(`✅ FOUND panorama at ${location.name}!`);
          
          // Create and add feature
          const coords = fromLonLat([panoramaResult.info.lon, panoramaResult.info.lat]);
          const testFeature = new Feature({
            geometry: new Point(coords),
            name: `${location.name} Panorama`,
            coordinates: [panoramaResult.info.lon, panoramaResult.info.lat],
            type: 'prague-test',
            date: panoramaResult.info.date
          });
          
          source.addFeature(testFeature);
          setPanoramaLocations(prev => [...prev, { lon: panoramaResult.info!.lon, lat: panoramaResult.info!.lat }]);
          setPanoramaWithDates(prev => [...prev, { 
            lon: panoramaResult.info!.lon, 
            lat: panoramaResult.info!.lat, 
            date: panoramaResult.info!.date 
          }]);
          
          console.log(`✅ Added ${location.name} panorama to map`);
        } else {
          console.log(`❌ No panorama found at ${location.name}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`🔥 Error testing ${location.name}:`, error);
      }
    }
    
    // Force refresh using centralized function
    forceRenderPanoramaLayer();
    
    console.log('🏰 Prague location test completed!');
    const finalCount = source.getFeatures().length;
    alert(`Prague Test Complete!\n\nTested ${pragueTestLocations.length} famous Prague locations\nFound ${finalCount} panoramas\n\nIf you see red dots on the map, the API and layer system is working correctly!`);
  };
  
  // COMPREHENSIVE DEBUG TEST - Direct panorama point addition
  const debugTestDirectPanoramaPoints = () => {
    console.log('🔍🔍🔍 CRITICAL DEBUG TEST - Direct Panorama Point Addition 🔍🔍🔍');
    
    // Step 1: Check layer availability
    console.log('📋 Step 1: Layer Availability Check');
    console.log('  panoramaLayer exists:', !!panoramaLayer);
    console.log('  panoramaLayer visible:', panoramaLayer?.getVisible());
    console.log('  panoramaLayer z-index:', panoramaLayer?.getZIndex());
    
    if (!panoramaLayer) {
      console.error('❌ CRITICAL: Panorama layer not available - cannot proceed');
      alert('❌ CRITICAL ERROR: Panorama layer not created. Check map initialization.');
      return;
    }
    
    const source = panoramaLayer.getSource();
    console.log('  source exists:', !!source);
    console.log('  source feature count:', source?.getFeatures().length || 0);
    
    if (!source) {
      console.error('❌ CRITICAL: Panorama source not available - cannot proceed');
      alert('❌ CRITICAL ERROR: Panorama source not available. Layer creation failed.');
      return;
    }
    
    // Step 2: Clear previous features
    console.log('📋 Step 2: Clearing Previous Features');
    const beforeClearCount = source.getFeatures().length;
    source.clear();
    const afterClearCount = source.getFeatures().length;
    console.log('  Features before clear:', beforeClearCount);
    console.log('  Features after clear:', afterClearCount);
    setPanoramaLocations([]);
    setPanoramaWithDates([]);
    
    // Step 3: Create test point with EXPLICIT styling and positioning
    console.log('📋 Step 3: Creating Direct Test Point with Maximum Visibility');
    
    // Get map center for positioning
    const mapCenter = mapInstanceRef.current?.getView().getCenter();
    if (!mapCenter) {
      console.error('❌ Cannot get map center');
      return;
    }
    
    const [centerLon, centerLat] = toLonLat(mapCenter);
    console.log('  Map center coordinates: [', centerLat.toFixed(6), ', ', centerLon.toFixed(6), '] (lat,lon)');
    
    // Create a highly visible test point
    const testCoords = [centerLon, centerLat];
    const projectedCoords = fromLonLat(testCoords);
    
    console.log('  Test coords (lon,lat):', testCoords);
    console.log('  Projected coords:', projectedCoords);
    
    // Create feature with maximum visibility properties
    const testFeature = new Feature({
      geometry: new Point(projectedCoords),
      name: 'CRITICAL DEBUG TEST POINT',
      coordinates: testCoords,
      type: 'debug-test',
      date: '2024-12-31 23:59:59',
      debugInfo: 'This point should be HIGHLY VISIBLE with red circle and white border'
    });
    
    // Step 4: Add feature to source
    console.log('📋 Step 4: Adding Feature to Source');
    console.log('  Feature geometry type:', testFeature.getGeometry()?.getType());
    console.log('  Feature properties:', testFeature.getProperties());
    
    source.addFeature(testFeature);
    
    // Step 5: Immediate verification
    console.log('📋 Step 5: Immediate Post-Addition Verification');
    const features = source.getFeatures();
    console.log('  Total features in source:', features.length);
    console.log('  Last feature name:', features[features.length - 1]?.get('name'));
    
    // Step 6: Layer style verification
    console.log('📋 Step 6: Layer Style Verification');
    const layerStyle = panoramaLayer.getStyle();
    console.log('  Layer style exists:', !!layerStyle);
    console.log('  Layer style object:', layerStyle);
    
    // Step 7: Force map refresh with multiple strategies
    console.log('📋 Step 7: Comprehensive Map Refresh');
    
    // Method 1: Layer changed
    panoramaLayer.changed();
    console.log('  ✓ panoramaLayer.changed() called');
    
    // Method 2: Source changed
    source.changed();
    console.log('  ✓ source.changed() called');
    
    // Method 3: Map render
    if (mapInstanceRef.current) {
      mapInstanceRef.current.render();
      console.log('  ✓ map.render() called');
      
      // Method 4: Force redraw all layers
      const mapLayers = mapInstanceRef.current.getLayers().getArray();
      mapLayers.forEach((layer, index) => {
        console.log(`  Layer ${index}: ${layer.constructor.name}, visible: ${layer.getVisible()}`);
        layer.changed();
        if ('getSource' in layer && typeof (layer as any).getSource === 'function') {
          (layer as any).getSource()?.changed();
        }
      });
      console.log('  ✓ All layers refreshed');
    }
    
    // Step 8: Update state
    console.log('📋 Step 8: Updating Component State');
    setPanoramaLocations([{ lon: centerLon, lat: centerLat }]);
    console.log('  ✓ State updated');
    
    // Step 9: Final verification and user feedback
    console.log('📋 Step 9: Final Verification');
    console.log('🟢🟢🟢 DEBUG TEST COMPLETE! 🟢🟢🟢');
    console.log('Summary:');
    console.log('  - Created 1 debug test point at map center');
    console.log('  - Point coordinates: [', centerLat.toFixed(6), ', ', centerLon.toFixed(6), ']');
    console.log('  - Features in source:', source.getFeatures().length);
    console.log('  - Layer visible:', panoramaLayer.getVisible());
    console.log('  - Layer z-index:', panoramaLayer.getZIndex());
    
    // Show user alert
    alert(
      `🔍 CRITICAL DEBUG TEST COMPLETE!\n\n` +
      `✅ Added 1 debug test point at map center\n` +
      `📍 Location: [${centerLat.toFixed(6)}, ${centerLon.toFixed(6)}]\n` +
      `📊 Features in layer: ${source.getFeatures().length}\n` +
      `👁️ Layer visible: ${panoramaLayer.getVisible()}\n` +
      `📏 Layer z-index: ${panoramaLayer.getZIndex()}\n\n` +
      `❓ Can you see a RED CIRCLE with WHITE BORDER at map center?\n\n` +
      `If YES: The layer system works - issue is with API/data\n` +
      `If NO: The layer system is broken - check style/visibility`
    );
  };

  // TEST BOT - Přidá test panorama body pro ověření funkčnosti UI
  const handleTestBot = async () => {
    console.log('🤖 TEST BOT STARTED - Testing UI functionality');
    
    if (!panoramaLayer) {
      console.error('❌ Panorama layer not available');
      return;
    }
    
    const source = panoramaLayer.getSource();
    if (!source) {
      console.error('❌ Panorama source not available');
      return;
    }
    
    // Vyčisti předchozí body
    source.clear();
    setPanoramaLocations([]);
    setPanoramaWithDates([]);
    console.log('✅ Cleared previous panorama points');
    
    // Získej střed aktuální mapy
    const mapCenter = mapInstanceRef.current?.getView().getCenter();
    if (!mapCenter) {
      console.error('❌ Cannot get map center');
      return;
    }
    
    const [centerLon, centerLat] = toLonLat(mapCenter);
    console.log(`🎯 Map center: [${centerLat.toFixed(6)}, ${centerLon.toFixed(6)}]`);
    
    // Vytvoř test body kolem středu mapy (rozložené pro lepší viditelnost)
    const testPanoramas = [
      { lon: centerLon + 0.003, lat: centerLat + 0.003, name: "Test Bot 1 - NorthEast" },
      { lon: centerLon - 0.003, lat: centerLat + 0.003, name: "Test Bot 2 - NorthWest" },
      { lon: centerLon + 0.003, lat: centerLat - 0.003, name: "Test Bot 3 - SouthEast" },
      { lon: centerLon - 0.003, lat: centerLat - 0.003, name: "Test Bot 4 - SouthWest" },
      { lon: centerLon, lat: centerLat, name: "Test Bot 5 - Center" },
      { lon: centerLon + 0.001, lat: centerLat + 0.004, name: "Test Bot 6 - North" },
      { lon: centerLon + 0.004, lat: centerLat, name: "Test Bot 7 - East" },
      { lon: centerLon, lat: centerLat - 0.004, name: "Test Bot 8 - South" },
      { lon: centerLon - 0.004, lat: centerLat, name: "Test Bot 9 - West" }
    ];
    
    console.log(`🤖 Creating ${testPanoramas.length} test panorama points...`);
    
    // Přidej body postupně s animací
    for (let i = 0; i < testPanoramas.length; i++) {
      const pano = testPanoramas[i];
      
      console.log(`🔍 Adding test panorama ${i + 1}: ${pano.name} at [${pano.lat.toFixed(6)}, ${pano.lon.toFixed(6)}]`);
      
      // Vytvoř panorama bod
      const coords = fromLonLat([pano.lon, pano.lat]);
      const testFeature = new Feature({
        geometry: new Point(coords),
        name: pano.name,
        coordinates: [pano.lon, pano.lat],
        type: 'test-bot',
        date: `2024-01-${String(i + 1).padStart(2, '0')} 14:00:00`
      });
      
      // Přidej na mapu
      source.addFeature(testFeature);
      console.log(`✅ Added test panorama ${i + 1} to map`);
      
      // Aktualizuj state
      setPanoramaLocations(prev => [...prev, { lon: pano.lon, lat: pano.lat }]);
      
      // Krátká pauza pro animaci
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // Force refresh using centralized function
    console.log('🔄 Forcing map refresh after test bot...');
    forceRenderPanoramaLayer();
    
    console.log(`🤖 TEST BOT COMPLETE! Added ${testPanoramas.length} test panorama points`);
    console.log(`📊 Total features in panorama layer: ${source.getFeatures().length}`);
    console.log(`📍 PanoramaLocations state: ${panoramaLocations.length} items`);
    
    // Debug info o všech bodech
    const features = source.getFeatures();
    console.log('🔴 All test features:');
    features.forEach((feature, index) => {
      const coords = feature.get('coordinates');
      const name = feature.get('name');
      console.log(`🔴 ${index + 1}: ${name} at [${coords[1]}, ${coords[0]}]`);
    });
    
    alert(`🤖 Test Bot Complete!\n\n✅ Added ${testPanoramas.length} test panorama points around map center\n🔍 You should see ${testPanoramas.length} red dots spread on the map\n👆 Click on any red dot to see details\n\n🔧 If you see the red dots, the UI layer works correctly!\n📐 Now try drawing a polygon to test automatic detection.`);
  };

  // Funkce pro načtení panoramatických bodů v aktuálním výhledu mapy
  const loadPanoramasInView = async () => {
    if (!mapInstanceRef.current || !panoramaLayer) return;

    const map = mapInstanceRef.current;
    const panoSource = panoramaLayer.getSource();
    if (!panoSource) return;

    // Smažeme předchozí body a resetujeme stav
    console.log('🔄 Čistím předchozí body panorama před načtením nových...');
    panoSource.clear();
    seen.clear();
    setPanoramaLocations([]);
    setPanoramaWithDates([]);
    setAnalysisResults([]);
    setSelectedForAnalysis(new Set());


    // If a polygon exists, restrict loading to polygon area with 15m grid
    const polygons = vectorSourceRef.current?.getFeatures() || [];
    const polygonGeom = polygons.find(f => f.getGeometry()?.getType() === 'Polygon')?.getGeometry() as Polygon | undefined;
    const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
    if (!API_KEY) return;

    // Use a unified grid generation and processing logic
    let gridPoints: { lon: number; lat: number }[] = [];
    let searchRadius = 50; // Default for viewport

    if (polygonGeom) {
      const [w, s] = toLonLat([polygonGeom.getExtent()[0], polygonGeom.getExtent()[1]]);
      const [e, n] = toLonLat([polygonGeom.getExtent()[2], polygonGeom.getExtent()[3]]);
      const polygonCoords = polygonToCoords(polygonGeom);
      gridPoints = generateComprehensivePointsInPolygon(polygonCoords, w, s, e, n, 15, 3000);
      searchRadius = 25; // Smaller radius for dense grid
      console.log(`🌍 Loading panoramas INSIDE polygon with ${gridPoints.length} grid points (15m spacing)`);
    } else {
      // Fallback: no polygon -> viewport grid
      const view = map.getView();
      const extent = view.calculateExtent(map.getSize());
      const [w, s] = toLonLat([extent[0], extent[1]]);
      const [e, n] = toLonLat([extent[2], extent[3]]);
      console.log(`🌍 Loading panoramas in current view: W=${w.toFixed(4)} S=${s.toFixed(4)} E=${e.toFixed(4)} N=${n.toFixed(4)}`);
      
      // Vytvoř menší grid pro rychlejší načítání
      const gridSize = 10; // 10x10 = 100 bodů, hustší pro lepší pokrytí
      const stepX = (e - w) / gridSize;
      const stepY = (n - s) / gridSize;
      
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const lon = w + (i + 0.5) * stepX;
          const lat = s + (j + 0.5) * stepY;
          gridPoints.push({ lon, lat });
        }
      }
      console.log(`📍 Testing ${gridPoints.length} grid points for panoramas...`);
    }

    if (gridPoints.length === 0) return;

    // Fire all requests at once
    const allPanoramaPromises = gridPoints.map(point => 
      checkPanoramaExists(point.lon, point.lat, API_KEY, searchRadius)
    );

    const results = await Promise.allSettled(allPanoramaPromises);

    let foundCount = 0;
    const newFeatures: Feature[] = [];
    const newResults: any[] = [];
    const newPanoramaLocations: {lon: number, lat: number}[] = [];
    const newPanoramaWithDates: {lon: number, lat: number, date: string}[] = [];

    results.forEach(promiseResult => {
      if (promiseResult.status === 'fulfilled' && promiseResult.value) {
        const panoramaResult = promiseResult.value;
        if (panoramaResult.exists && panoramaResult.info) {
          const key = `${panoramaResult.info.lat.toFixed(6)}_${panoramaResult.info.lon.toFixed(6)}`;
          if (seen.has(key)) return;
          seen.add(key);
          
          foundCount++;
          
          const feature = new Feature({
            geometry: new Point(fromLonLat([panoramaResult.info.lon, panoramaResult.info.lat])),
            name: `Panorama ${foundCount}`,
            coordinates: [panoramaResult.info.lon, panoramaResult.info.lat],
            date: panoramaResult.info.date || 'Unknown',
            type: 'view-panorama',
            panoramaInfo: panoramaResult.info
          });
          newFeatures.push(feature);

          newResults.push({
            id: foundCount,
            name: `Panorama ${foundCount}`,
            coordinates: [panoramaResult.info.lon, panoramaResult.info.lat],
            condition: 'pending',
            confidence: 0,
            issues: ['Čeká na AI analýzu'],
            recommendation: 'AI analýza bude spuštěna automaticky.',
            estimatedValue: 0,
            panoramaDate: panoramaResult.info.date,
            analysisStatus: 'pending'
          });

          newPanoramaLocations.push({ lon: panoramaResult.info.lon, lat: panoramaResult.info.lat });
          newPanoramaWithDates.push({
            lon: panoramaResult.info.lon,
            lat: panoramaResult.info.lat,
            date: panoramaResult.info.date
          });
        }
      }
    });

    if (newFeatures.length > 0) {
      panoSource.addFeatures(newFeatures); // Batch add all features
    }

    setPanoramaLocations(newPanoramaLocations);
    setPanoramaWithDates(newPanoramaWithDates);
    setAnalysisResults(newResults);
    
    // Spustíme AI analýzu na pozadí pro všechny nové výsledky
    runBatchAiAnalysis(newResults);
    
    console.log(`✅ Loaded ${foundCount} panorama points in current view`);
    
    // Refresh map using centralized function  
    forceRenderPanoramaLayer();
  };

  // Export functionality
  const handleExport = (format: 'csv' | 'json') => {
    if (analysisResults.length === 0) {
      alert('No analysis results to export');
      return;
    }

    if (format === 'json') {
      const dataStr = JSON.stringify(analysisResults, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'property-analysis-results.json';
      link.click();
    } else if (format === 'csv') {
      const headers = ['ID', 'Name', 'Latitude', 'Longitude', 'Condition', 'Confidence', 'Issues', 'Recommendation', 'Estimated Value'];
      const csvContent = [
        headers.join(','),
        ...analysisResults.map(result => [
          result.id,
          `"${result.name}"`,
          result.coordinates[1],
          result.coordinates[0],
          result.condition,
          (result.confidence * 100).toFixed(1) + '%',
          `"${result.issues.join('; ')}"`,
          `"${result.recommendation}"`,
          result.estimatedValue
        ].join(','))
      ].join('\n');
      
      const dataBlob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'property-analysis-results.csv';
      link.click();
    }
  };


  if (error) {
    return (
      <div className="fixed inset-0 bg-dark-bg flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <button
            onClick={onBack}
            className="bg-electric-blue hover:bg-electric-blue/80 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-dark-bg z-50 flex text-white">
      {/* Loading Overlay */}
      {(isLoading || isAnalyzing) && (
        <div className="absolute inset-0 bg-dark-bg/90 flex items-center justify-center z-50">
          <div className="text-center bg-dark-card/90 backdrop-blur-sm border border-electric-blue/20 p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-electric-blue mb-4 mx-auto"></div>
            <div className="text-white text-lg mb-2">
              {isLoading ? 'Načítání mapy...' : 'Vyhledávání panorama lokací...'}
            </div>
            {isAnalyzing && (
              <div className="text-center">
                <div className="text-electric-blue text-sm mb-2">
                  Prohledávám oblast: {analysisProgress}%
                </div>
                <div className="w-64 bg-gray-700 h-2">
                  <div 
                    className="bg-gradient-to-r from-electric-blue to-deep-purple h-2 transition-all duration-300"
                    style={{ width: `${analysisProgress}%` }}
                  ></div>
                </div>
                {panoramaLocations.length > 0 && (
                  <div className="text-green-400 text-sm mt-2">
                    Nalezeno {analysisResults.length} panoramat
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className="w-72 bg-dark-card border-r border-gray-800 flex flex-col z-20 p-4 space-y-4">
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-bold text-white">Flip<span className="text-electric-blue">akt</span></h1>
          <p className="text-xs text-gray-400">Property Analysis Tool</p>
        </div>

        {/* Controls */}
        <div className="flex-grow flex flex-col space-y-2">
            <button
                onClick={handleDrawArea}
                className={`w-full px-4 py-3 font-medium transition-all duration-300 flex items-center gap-3 text-left ${
                  isDrawingMode
                    ? 'bg-electric-blue text-white'
                    : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>{isDrawingMode ? 'Kreslení...' : 'Vymezit oblast'}</span>
            </button>
             <button
                onClick={loadPanoramasInView}
                className="w-full px-4 py-3 font-medium transition-all duration-300 flex items-center gap-3 text-left bg-gray-800 text-gray-200 hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Načíst panoramata</span>
            </button>
            
            {panoramaLocations.length > 0 && (
              <button
                onClick={() => setShowPanoramaGallery(true)}
                className="w-full px-4 py-3 font-medium transition-all duration-300 flex items-center gap-3 text-left bg-gray-800 text-gray-200 hover:bg-gray-700"
                disabled={panoramaWithDates.length === 0}
              >
                <span>🏞️</span>
                <span>Zobrazit snímky</span>
                <span className="ml-auto bg-electric-blue/20 text-electric-blue px-2 py-0.5 text-xs font-bold">
                  {panoramaLocations.length}
                </span>
              </button>
            )}
            {selectedForAnalysis.size > 0 && (
                <button
                    onClick={handleRunAiAnalysis}
                    className="w-full px-4 py-3 font-bold transition-all duration-300 flex items-center gap-3 text-left bg-green-600 text-white hover:bg-green-500"
                    disabled={isAiAnalyzing}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    <span>{isAiAnalyzing ? 'Analyzuji...' : `Spustit AI Analýzu (${selectedForAnalysis.size})`}</span>
                </button>
            )}
        </div>
        
        {/* Status Panel */}
        <div className="flex-shrink-0 bg-gray-900 border border-gray-800 p-3 text-xs">
          <div className="font-bold text-gray-300 mb-2">Stav systému</div>
          <div className="space-y-1">
              <div>Panorama bodů: <span className="font-mono text-green-400 float-right">{panoramaLocations.length}</span></div>
              <div>Polygon: <span className={`font-mono float-right ${hasPolygon ? "text-green-400" : "text-gray-500"}`}>{hasPolygon ? "Vymezen" : "Není"}</span></div>
              <div>API Klíč: <span className={`font-mono float-right ${process.env.REACT_APP_MAPY_API_KEY ? "text-green-400" : "text-red-400"}`}>{process.env.REACT_APP_MAPY_API_KEY ? "Dostupný" : "Chybí"}</span></div>
              <div>JS Chyby: <span className={`font-mono float-right ${jsErrors.length === 0 ? "text-green-400" : "text-red-400"}`}>{jsErrors.length}</span></div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={onBack}
            className="w-full text-left bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-3 transition-colors duration-300 flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zpět na domovskou stránku
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative">
          {/* Map Container */}
          <div
            ref={mapRef}
            className="w-full h-full"
          />

          {/* Analysis Panel Toggle Button */}
          {analysisResults.length > 0 && (
            <button
              onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
              className="absolute top-4 right-4 z-20 bg-dark-card hover:bg-gray-800 border border-gray-700 text-white p-3 shadow-lg transition-all duration-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          )}

          {/* Analysis Panel */}
          {showAnalysisPanel && (
            <AnalysisPanel 
              results={analysisResults} 
              onExport={handleExport}
              selectedIds={selectedForAnalysis}
              onToggleSelection={handleToggleAnalysisSelection}
            />
          )}

          {/* Panorama Gallery */}
          {showPanoramaGallery && (
            <div className="absolute inset-0 z-50 bg-dark-bg">
              <PanoramaGallery 
                locations={panoramaWithDates}
                apiKey={process.env.REACT_APP_MAPY_API_KEY || ''}
                onClose={() => setShowPanoramaGallery(false)}
              />
            </div>
          )}
      </main>
    </div>
  );
};

export default MapView;