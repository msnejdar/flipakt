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
    height: PANORAMA_DEFAULTS.defaultHeight
  });

  const [imageState, setImageState] = useState({
    url: '',
    loading: false,
    error: null as string | null,
    lastUpdate: 0
  });

  const [isDownloading, setIsDownloading] = useState(false);
  
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
      height: PANORAMA_DEFAULTS.defaultHeight
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
    <div className={`panorama-viewer bg-dark-bg text-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-electric-blue/20">
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-bold text-electric-blue">Panorama Viewer</h3>
          <div className="text-sm text-gray-300">
            <span>📍 {lat.toFixed(6)}, {lon.toFixed(6)}</span>
            <span className="ml-4">📅 {date}</span>
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-card/50 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Controls Panel */}
      <div className="p-4 border-b border-electric-blue/20 bg-dark-card/30">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Yaw Control */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Yaw (°) <span className="text-gray-400">[← →]</span>
            </label>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={controls.yaw}
              onChange={(e) => handleControlChange('yaw', parseInt(e.target.value))}
              className="w-full accent-electric-blue"
            />
            <div className="text-xs text-center mt-1 text-gray-300">{controls.yaw}°</div>
          </div>

          {/* Pitch Control */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Pitch (°) <span className="text-gray-400">[↑ ↓]</span>
            </label>
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={controls.pitch}
              onChange={(e) => handleControlChange('pitch', parseInt(e.target.value))}
              className="w-full accent-electric-blue"
            />
            <div className="text-xs text-center mt-1 text-gray-300">{controls.pitch}°</div>
          </div>

          {/* FOV Control */}
          <div>
            <label className="block text-sm font-medium mb-1">Field of View</label>
            <input
              type="range"
              min={PANORAMA_DEFAULTS.minFov}
              max={PANORAMA_DEFAULTS.maxFov}
              step="1"
              value={controls.fov}
              onChange={(e) => handleControlChange('fov', parseInt(e.target.value))}
              className="w-full accent-electric-blue"
            />
            <div className="text-xs text-center mt-1 text-gray-300">{controls.fov}°</div>
          </div>

          {/* Width Control */}
          <div>
            <label className="block text-sm font-medium mb-1">Width</label>
            <select
              value={controls.width}
              onChange={(e) => handleControlChange('width', parseInt(e.target.value))}
              className="w-full bg-dark-card text-white border border-electric-blue/20 rounded px-2 py-1 text-sm"
            >
              <option value={640}>640px</option>
              <option value={800}>800px</option>
              <option value={1024}>1024px (max)</option>
            </select>
          </div>

          {/* Height Control */}
          <div>
            <label className="block text-sm font-medium mb-1">Height</label>
            <select
              value={controls.height}
              onChange={(e) => handleControlChange('height', parseInt(e.target.value))}
              className="w-full bg-dark-card text-white border border-electric-blue/20 rounded px-2 py-1 text-sm"
            >
              <option value={480}>480px</option>
              <option value={600}>600px</option>
              <option value={800}>800px</option>
              <option value={1024}>1024px (max)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex space-x-2">
            <button
              onClick={resetControls}
              className="px-3 py-1 bg-dark-card hover:bg-electric-blue/20 border border-electric-blue/20 rounded-lg text-sm transition-colors"
              title="Reset controls (R)"
            >
              🔄 Reset
            </button>
            
            <button
              onClick={handleDownload}
              disabled={isDownloading || imageState.loading}
              className="px-3 py-1 bg-electric-blue hover:bg-electric-blue/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors flex items-center space-x-1"
              title="Download image (Ctrl+D)"
            >
              {isDownloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Download</span>
                </>
              )}
            </button>
          </div>

          <div className="text-xs text-gray-400">
            Use arrow keys to navigate • R to reset • Ctrl+D to download • Esc to close
          </div>
        </div>
      </div>

      {/* Image Display */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gray-900">
        {imageState.loading ? (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-electric-blue/20 border-t-electric-blue rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-300">Loading panorama...</p>
          </div>
        ) : imageState.error ? (
          <div className="text-center text-red-400">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-lg mb-2">Failed to load panorama</p>
            <p className="text-sm text-gray-400">{imageState.error}</p>
            <button
              onClick={updateImage}
              className="mt-4 px-4 py-2 bg-electric-blue hover:bg-electric-blue/80 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : imageState.url ? (
          <div className="max-w-full max-h-full overflow-hidden rounded-lg shadow-2xl">
            <img
              src={imageState.url}
              alt={`Panorama at ${lat.toFixed(6)}, ${lon.toFixed(6)}`}
              className="max-w-full max-h-full object-contain"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh'
              }}
            />
          </div>
        ) : null}
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t border-electric-blue/20 bg-dark-card/20 text-xs text-gray-400 flex justify-between">
        <span>
          Resolution: {controls.width}x{controls.height} | 
          View: {controls.yaw}°/{controls.pitch}°/{controls.fov}°
        </span>
        <span>
          Last updated: {imageState.lastUpdate ? new Date(imageState.lastUpdate).toLocaleTimeString() : 'Never'}
        </span>
      </div>
    </div>
  );
};

export default PanoramaViewer;