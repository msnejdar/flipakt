import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PanoramaImage, PanoramaLocation, PanoramaControlsState, PANORAMA_DEFAULTS } from '../types/panoramaViewer';
import { PanoramaApiService } from '../utils/panoramaApi';
import PanoramaViewer from './PanoramaViewer';

interface PanoramaGalleryProps {
  locations: PanoramaLocation[];
  apiKey: string;
  onClose?: () => void;
  className?: string;
}

interface ThumbnailSettings {
  width: number;
  height: number;
  yaw: number;
  pitch: number;
  fov: number;
}

const PanoramaGallery: React.FC<PanoramaGalleryProps> = ({
  locations,
  apiKey,
  onClose,
  className = ''
}) => {
  // State management
  const [selectedPanorama, setSelectedPanorama] = useState<PanoramaLocation | null>(null);
  const [thumbnailSettings, setThumbnailSettings] = useState<ThumbnailSettings>({
    width: 300,
    height: 200,
    yaw: 0,
    pitch: 0,
    fov: 90
  });
  
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(new Set());
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set());
  
  const [batchDownloadStatus, setBatchDownloadStatus] = useState<{
    active: boolean;
    progress: number;
    total: number;
    current: number;
  }>({
    active: false,
    progress: 0,
    total: 0,
    current: 0
  });

  // Refs
  const panoramaApiRef = useRef<PanoramaApiService | null>(null);
  const thumbnailObserverRef = useRef<IntersectionObserver | null>(null);

  // Initialize API service
  useEffect(() => {
    panoramaApiRef.current = new PanoramaApiService(apiKey);
    
    return () => {
      if (panoramaApiRef.current) {
        panoramaApiRef.current.clearCache();
      }
    };
  }, [apiKey]);

  // Create location key for caching
  const createLocationKey = (location: PanoramaLocation): string => {
    return `${location.lon}_${location.lat}_${thumbnailSettings.width}_${thumbnailSettings.height}_${thumbnailSettings.yaw}_${thumbnailSettings.pitch}_${thumbnailSettings.fov}`;
  };

  // Load thumbnail for a specific location
  const loadThumbnail = useCallback(async (location: PanoramaLocation) => {
    if (!panoramaApiRef.current) return;

    const key = createLocationKey(location);
    
    // Skip if already loading, loaded, or failed
    if (loadingThumbnails.has(key) || thumbnails.has(key) || thumbnailErrors.has(key)) {
      return;
    }

    // Mark as loading
    setLoadingThumbnails(prev => new Set(Array.from(prev).concat(key)));

    try {
      const response = await panoramaApiRef.current.fetchPanoramaImage(
        location.lon,
        location.lat,
        {
          width: thumbnailSettings.width,
          height: thumbnailSettings.height,
          yaw: thumbnailSettings.yaw,
          pitch: thumbnailSettings.pitch,
          fov: thumbnailSettings.fov
        }
      );

      if (response.success && response.imageUrl) {
        setThumbnails(prev => new Map(prev.set(key, response.imageUrl!)));
      } else {
        setThumbnailErrors(prev => new Set(Array.from(prev).concat(key)));
      }
    } catch (error) {
      console.error('Thumbnail load error:', error);
      setThumbnailErrors(prev => new Set(Array.from(prev).concat(key)));
    } finally {
      setLoadingThumbnails(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  }, [thumbnailSettings, loadingThumbnails, thumbnails, thumbnailErrors]);

  // Set up intersection observer for lazy loading
  useEffect(() => {
    thumbnailObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const locationIndex = parseInt(entry.target.getAttribute('data-location-index') || '0');
            const location = locations[locationIndex];
            if (location) {
              loadThumbnail(location);
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    return () => {
      if (thumbnailObserverRef.current) {
        thumbnailObserverRef.current.disconnect();
      }
    };
  }, [locations, loadThumbnail]);

  // Observe thumbnail elements
  const observeThumbnail = useCallback((element: HTMLDivElement | null, index: number) => {
    if (!element || !thumbnailObserverRef.current) return;

    element.setAttribute('data-location-index', index.toString());
    thumbnailObserverRef.current.observe(element);
  }, []);

  // Handle thumbnail settings change
  const handleThumbnailSettingsChange = (key: keyof ThumbnailSettings, value: number) => {
    setThumbnailSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Clear existing thumbnails to force reload
    setThumbnails(new Map());
    setThumbnailErrors(new Set());
  };

  // Batch download handler
  const handleBatchDownload = async () => {
    if (!panoramaApiRef.current || batchDownloadStatus.active) return;

    setBatchDownloadStatus({
      active: true,
      progress: 0,
      total: locations.length,
      current: 0
    });

    try {
      const result = await panoramaApiRef.current.batchDownloadPanoramas(
        locations,
        {
          width: 1920,
          height: 1080,
          yaw: 0,
          pitch: 0,
          fov: 90
        },
        (current, total) => {
          setBatchDownloadStatus(prev => ({
            ...prev,
            current,
            progress: (current / total) * 100
          }));
        }
      );

      alert(`Batch download completed!\nSuccess: ${result.success}\nFailed: ${result.failed}`);
      
    } catch (error) {
      console.error('Batch download error:', error);
      alert('Batch download failed');
    } finally {
      setBatchDownloadStatus({
        active: false,
        progress: 0,
        total: 0,
        current: 0
      });
    }
  };

  // Load all thumbnails
  const loadAllThumbnails = async () => {
    for (const location of locations) {
      await loadThumbnail(location);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  if (selectedPanorama) {
    return (
      <PanoramaViewer
        lon={selectedPanorama.lon}
        lat={selectedPanorama.lat}
        date={selectedPanorama.date}
        apiKey={apiKey}
        onClose={() => setSelectedPanorama(null)}
        className={className}
      />
    );
  }

  return (
    <div className={`panorama-gallery bg-dark-bg text-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-electric-blue/20">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-electric-blue">Panorama Gallery</h2>
          <div className="text-sm text-gray-300">
            {locations.length} panorama{locations.length !== 1 ? 's' : ''} found
          </div>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-card/50 rounded-lg transition-colors"
            title="Close Gallery"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-electric-blue/20 bg-dark-card/30">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
          {/* Thumbnail size */}
          <div>
            <label className="block text-sm font-medium mb-1">Thumbnail Size</label>
            <select
              value={`${thumbnailSettings.width}x${thumbnailSettings.height}`}
              onChange={(e) => {
                const [width, height] = e.target.value.split('x').map(Number);
                setThumbnailSettings(prev => ({ ...prev, width, height }));
                setThumbnails(new Map());
                setThumbnailErrors(new Set());
              }}
              className="w-full bg-dark-card text-white border border-electric-blue/20 rounded px-2 py-1 text-sm"
            >
              <option value="200x133">Small (200x133)</option>
              <option value="300x200">Medium (300x200)</option>
              <option value="400x267">Large (400x267)</option>
            </select>
          </div>

          {/* Yaw */}
          <div>
            <label className="block text-sm font-medium mb-1">Yaw</label>
            <input
              type="range"
              min="0"
              max="360"
              step="45"
              value={thumbnailSettings.yaw}
              onChange={(e) => handleThumbnailSettingsChange('yaw', parseInt(e.target.value))}
              className="w-full accent-electric-blue"
            />
            <div className="text-xs text-center text-gray-300">{thumbnailSettings.yaw}°</div>
          </div>

          {/* Pitch */}
          <div>
            <label className="block text-sm font-medium mb-1">Pitch</label>
            <input
              type="range"
              min="-45"
              max="45"
              step="15"
              value={thumbnailSettings.pitch}
              onChange={(e) => handleThumbnailSettingsChange('pitch', parseInt(e.target.value))}
              className="w-full accent-electric-blue"
            />
            <div className="text-xs text-center text-gray-300">{thumbnailSettings.pitch}°</div>
          </div>

          {/* FOV */}
          <div>
            <label className="block text-sm font-medium mb-1">FOV</label>
            <input
              type="range"
              min="30"
              max="120"
              step="30"
              value={thumbnailSettings.fov}
              onChange={(e) => handleThumbnailSettingsChange('fov', parseInt(e.target.value))}
              className="w-full accent-electric-blue"
            />
            <div className="text-xs text-center text-gray-300">{thumbnailSettings.fov}°</div>
          </div>

          {/* Load All Button */}
          <div className="flex items-end">
            <button
              onClick={loadAllThumbnails}
              className="w-full px-3 py-1 bg-electric-blue hover:bg-electric-blue/80 rounded-lg text-sm transition-colors"
            >
              Load All
            </button>
          </div>

          {/* Batch Download */}
          <div className="flex items-end">
            <button
              onClick={handleBatchDownload}
              disabled={batchDownloadStatus.active}
              className="w-full px-3 py-1 bg-deep-purple hover:bg-deep-purple/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors flex items-center justify-center space-x-1"
            >
              {batchDownloadStatus.active ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>{batchDownloadStatus.current}/{batchDownloadStatus.total}</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Download All</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {batchDownloadStatus.active && (
          <div className="w-full bg-dark-card rounded-full h-2">
            <div 
              className="bg-electric-blue h-2 rounded-full transition-all duration-300"
              style={{ width: `${batchDownloadStatus.progress}%` }}
            ></div>
          </div>
        )}
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {locations.map((location, index) => {
            const key = createLocationKey(location);
            const thumbnailUrl = thumbnails.get(key);
            const isLoading = loadingThumbnails.has(key);
            const hasError = thumbnailErrors.has(key);

            return (
              <div
                key={`${location.lon}_${location.lat}_${index}`}
                ref={(el) => observeThumbnail(el, index)}
                className="bg-dark-card rounded-lg overflow-hidden shadow-lg hover:shadow-electric-blue/25 transition-shadow cursor-pointer border border-electric-blue/20 hover:border-electric-blue/50"
                onClick={() => setSelectedPanorama(location)}
              >
                {/* Thumbnail */}
                <div 
                  className="relative bg-gray-800 flex items-center justify-center"
                  style={{ 
                    height: `${thumbnailSettings.height}px`,
                    aspectRatio: `${thumbnailSettings.width}/${thumbnailSettings.height}`
                  }}
                >
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-2 border-electric-blue/20 border-t-electric-blue rounded-full animate-spin mb-2"></div>
                      <span className="text-xs text-gray-400">Loading...</span>
                    </div>
                  ) : hasError ? (
                    <div className="flex flex-col items-center text-red-400">
                      <div className="text-3xl mb-2">⚠️</div>
                      <span className="text-xs">Failed to load</span>
                    </div>
                  ) : thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={`Panorama at ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-gray-400">
                      <div className="text-3xl mb-2">🏞️</div>
                      <span className="text-xs">Click to load</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                    <div className="bg-electric-blue text-white px-3 py-1 rounded text-sm font-medium">
                      View Full
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="text-xs text-gray-300 mb-1">
                    📍 {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                  </div>
                  <div className="text-xs text-electric-blue">
                    📅 {location.date}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    View: {thumbnailSettings.yaw}°/{thumbnailSettings.pitch}°/{thumbnailSettings.fov}°
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {locations.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏞️</div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No panoramas found</h3>
            <p className="text-gray-400">No panorama locations were provided for this gallery.</p>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="p-2 border-t border-electric-blue/20 bg-dark-card/20 text-xs text-gray-400 flex justify-between">
        <span>
          Loaded: {thumbnails.size}/{locations.length} | 
          Loading: {loadingThumbnails.size} | 
          Errors: {thumbnailErrors.size}
        </span>
        <span>
          View settings: {thumbnailSettings.yaw}°/{thumbnailSettings.pitch}°/{thumbnailSettings.fov}° | 
          Size: {thumbnailSettings.width}x{thumbnailSettings.height}
        </span>
      </div>
    </div>
  );
};

export default PanoramaGallery;