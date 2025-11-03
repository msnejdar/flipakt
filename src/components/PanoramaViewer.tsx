import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PanoramaImage, PanoramaControlsState, PANORAMA_DEFAULTS } from '../types/panoramaViewer';
import { PanoramaApiService } from '../utils/panoramaApi';

interface PanoramaViewerProps {
  lon: number;
  lat: number;
  date: string;
  apiKey: string;
  onClose?: () => void;
  className?: string;
}

const PanoramaViewer: React.FC<PanoramaViewerProps> = ({
  lon,
  lat,
  date,
  apiKey,
  onClose,
  className = ''
}) => {
  // State management
  const [controls, setControls] = useState<PanoramaControlsState>({
    yaw: PANORAMA_DEFAULTS.defaultYaw,
    pitch: PANORAMA_DEFAULTS.defaultPitch,
    fov: PANORAMA_DEFAULTS.defaultFov,
    width: PANORAMA_DEFAULTS.defaultWidth,
    height: 800
  });

  const [imageState, setImageState] = useState({
    url: '',
    loading: false,
    error: null as string | null,
    lastUpdate: 0
  });

  const [isDownloading, setIsDownloading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  
  // Refs
  const panoramaApiRef = useRef<PanoramaApiService | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Initialize API service
  useEffect(() => {
    panoramaApiRef.current = new PanoramaApiService(apiKey);
    
    return () => {
      if (panoramaApiRef.current) {
        panoramaApiRef.current.clearCache();
      }
    };
  }, [apiKey]);

  // Debounced image update function
  const updateImage = useCallback(async () => {
    if (!panoramaApiRef.current) return;

    setImageState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await panoramaApiRef.current.fetchPanoramaImage(lon, lat, controls);
      
      if (response.success && response.imageUrl) {
        setImageState(prev => ({
          ...prev,
          url: response.imageUrl!,
          loading: false,
          lastUpdate: Date.now()
        }));
      } else {
        setImageState(prev => ({
          ...prev,
          loading: false,
          error: response.error || 'Failed to load panorama'
        }));
      }
    } catch (error) {
      setImageState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [lon, lat, controls]);

  // Initial load
  useEffect(() => {
    updateImage();
  }, [lon, lat]); // Only re-trigger if the location fundamentally changes

  // Debounced update effect for controls changes
  useEffect(() => {
    const handler = setTimeout(() => {
      updateImage();
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [controls, updateImage]);


  const handleRunAiAnalysis = async () => {
    if (!imageState.url) {
      alert('Nejprve je třeba načíst obrázek panoramatu.');
      return;
    }

    setIsAiAnalyzing(true);
    setAiAnalysis(null);

    try {
      const blob = await fetch(imageState.url).then(r => r.blob());
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
          coordinates: [lon, lat]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI analýza selhala.');
      }

      const result = await response.json();
      setAiAnalysis(result);

    } catch (error) {
      console.error(`Chyba při AI analýze:`, error);
      setAiAnalysis({ error: (error as Error).message });
    } finally {
      setIsAiAnalyzing(false);
    }
  };


  // Control handlers
  const handleControlChange = (key: keyof PanoramaControlsState, value: number) => {
    setControls(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetControls = () => {
    setControls({
      yaw: PANORAMA_DEFAULTS.defaultYaw,
      pitch: PANORAMA_DEFAULTS.defaultPitch,
      fov: PANORAMA_DEFAULTS.defaultFov,
      width: PANORAMA_DEFAULTS.defaultWidth,
      height: 800
    });
  };

  // Download handler
  const handleDownload = async () => {
    if (!panoramaApiRef.current || isDownloading) return;

    setIsDownloading(true);
    try {
      const filename = `panorama_${lon.toFixed(6)}_${lat.toFixed(6)}_yaw${controls.yaw}_${Date.now()}.jpg`;
      const success = await panoramaApiRef.current.downloadPanoramaImage(
        lon,
        lat,
        controls,
        filename
      );
      
      if (!success) {
        alert('Failed to download panorama image');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download panorama image');
    } finally {
      setIsDownloading(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      const step = 10;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handleControlChange('yaw', Math.max(0, controls.yaw - step));
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleControlChange('yaw', Math.min(360, controls.yaw + step));
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleControlChange('pitch', Math.min(90, controls.pitch + step));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleControlChange('pitch', Math.max(-90, controls.pitch - step));
          break;
        case 'Escape':
          onClose?.();
          break;
        case 'r':
          resetControls();
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleDownload();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [controls, onClose]);

  return (
    <div className={`panorama-viewer bg-dark-bg text-white flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-bold text-white">Detail snímku</h3>
          <div className="text-sm text-gray-400 font-mono">
            <span>📍 {lat.toFixed(6)}, {lon.toFixed(6)}</span>
            <span className="ml-4">📅 {new Date(date).toLocaleDateString()}</span>
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800"
            title="Zavřít (Esc)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Image Display */}
        <div className="flex-1 flex items-center justify-center p-4 bg-gray-900/50">
          {imageState.loading ? (
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-electric-blue/20 border-t-electric-blue rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-300">Načítám panorama...</p>
            </div>
          ) : imageState.error ? (
            <div className="text-center text-red-400">
              <div className="text-6xl mb-4">⚠️</div>
              <p className="text-lg mb-2">Nepodařilo se načíst panorama</p>
              <p className="text-sm text-gray-400 font-mono">{imageState.error}</p>
              <button
                onClick={updateImage}
                className="mt-4 px-4 py-2 bg-electric-blue hover:bg-electric-blue/80 transition-colors"
              >
                Opakovat
              </button>
            </div>
          ) : imageState.url ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={imageState.url}
                alt={`Panorama at ${lat.toFixed(6)}, ${lon.toFixed(6)}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : null}
        </div>

        {/* Right Sidebar */}
        <aside className="w-96 bg-dark-card border-l border-gray-800 p-4 flex flex-col space-y-4 overflow-y-auto">
          {/* Controls Panel */}
          <div>
            <h4 className="text-lg font-bold text-white mb-3">Ovládání pohledu</h4>
            <div className="space-y-3 text-sm">
              {/* Yaw, Pitch, FOV */}
              <div>
                <label className="block font-medium mb-1">Yaw (°) <span className="text-gray-400 font-mono">[← →]</span></label>
                <input type="range" min="0" max="360" step="1" value={controls.yaw} onChange={(e) => handleControlChange('yaw', parseInt(e.target.value))} className="w-full accent-electric-blue"/>
              </div>
              <div>
                <label className="block font-medium mb-1">Pitch (°) <span className="text-gray-400 font-mono">[↑ ↓]</span></label>
                <input type="range" min="-90" max="90" step="1" value={controls.pitch} onChange={(e) => handleControlChange('pitch', parseInt(e.target.value))} className="w-full accent-electric-blue"/>
              </div>
              <div>
                <label className="block font-medium mb-1">Zorné pole (FOV)</label>
                <input type="range" min={PANORAMA_DEFAULTS.minFov} max={PANORAMA_DEFAULTS.maxFov} step="1" value={controls.fov} onChange={(e) => handleControlChange('fov', parseInt(e.target.value))} className="w-full accent-electric-blue"/>
              </div>
              {/* Width & Height */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Šířka</label>
                  <select value={controls.width} onChange={(e) => handleControlChange('width', parseInt(e.target.value))} className="w-full bg-gray-800 border border-gray-700 px-2 py-1 text-white text-sm focus:border-electric-blue outline-none appearance-none">
                    <option value={640}>640px</option>
                    <option value={800}>800px</option>
                    <option value={1024}>1024px (max)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Výška</label>
                  <select value={controls.height} onChange={(e) => handleControlChange('height', parseInt(e.target.value))} className="w-full bg-gray-800 border border-gray-700 px-2 py-1 text-white text-sm focus:border-electric-blue outline-none appearance-none">
                    <option value={480}>480px</option>
                    <option value={600}>600px</option>
                    <option value={800}>800px</option>
                    <option value={1024}>1024px (max)</option>
                  </select>
                </div>
              </div>
              {/* Actions */}
              <div className="flex space-x-2 pt-2">
                <button onClick={resetControls} className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm transition-colors" title="Reset (R)">Reset</button>
                <button onClick={handleDownload} disabled={isDownloading || imageState.loading} className="flex-1 px-3 py-2 bg-electric-blue hover:bg-electric-blue/80 disabled:opacity-50 text-sm transition-colors" title="Download (Ctrl+D)">Stáhnout</button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800"></div>

          {/* AI Analysis Panel */}
          <div>
            <h4 className="text-lg font-bold text-white mb-3">AI Analýza</h4>
            <button
              onClick={handleRunAiAnalysis}
              disabled={isAiAnalyzing || imageState.loading || !!imageState.error}
              className="w-full px-4 py-3 font-bold transition-all duration-300 flex items-center justify-center gap-3 text-left bg-green-600 text-white hover:bg-green-500 disabled:bg-gray-600"
            >
              {isAiAnalyzing 
                ? 'Analyzuji...' 
                : (aiAnalysis ? 'Spustit analýzu znovu' : 'Spustit AI Analýzu')}
            </button>
            {isAiAnalyzing && <div className="text-center text-sm text-gray-400 mt-2">Analýza může trvat několik sekund...</div>}

            {aiAnalysis && (
              <div className="mt-4 space-y-3 text-xs bg-gray-900 border border-gray-800 p-3">
                {aiAnalysis.error ? (
                  <div className="text-red-400">Chyba: {aiAnalysis.error}</div>
                ) : (
                  <>
                    <div>
                      <h5 className="font-semibold text-gray-300 mb-1">Stáří a styl</h5>
                      <p className="text-gray-400">{aiAnalysis.stari_a_styl}</p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-300 mb-1">Checklist Zanedbání (0-10)</h5>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {Object.entries(aiAnalysis.checklist).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-mono text-white">{value as any}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                     <div>
                      <h5 className="font-semibold text-gray-300 mb-1">Souhrn</h5>
                      <p className="text-gray-400"><span className="text-red-400 font-semibold">Negativa:</span> {aiAnalysis.souhrn.negativa.join(', ')}</p>
                      <p className="font-bold text-lg text-center mt-2 text-yellow-400">{aiAnalysis.souhrn.potencial_prodeje_skore} / 100</p>
                      <p className="text-center text-xs text-gray-400">Skóre potenciálu prodeje</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PanoramaViewer;