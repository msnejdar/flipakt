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

// Helper function to create location key
const createLocationKey = (location: PanoramaLocation): string => {
  return `${location.lon}_${location.lat}`;
};

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

  // AI Analysis state - ALL selected by default
  const [selectedForAnalysis, setSelectedForAnalysis] = useState<Set<string>>(() => {
    const allKeys = new Set<string>();
    locations.forEach(loc => allKeys.add(createLocationKey(loc)));
    return allKeys;
  });
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysisProgress, setAiAnalysisProgress] = useState({ current: 0, total: 0 });
  const [analysisResults, setAnalysisResults] = useState<Map<string, any>>(new Map());

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
  const isMounted = useRef(true);

  // Initialize API service
  useEffect(() => {
    panoramaApiRef.current = new PanoramaApiService(apiKey);
    isMounted.current = true;

    // Automatically load all thumbnails on component mount
    loadAllThumbnails();

    return () => {
      isMounted.current = false;
      if (panoramaApiRef.current) {
        panoramaApiRef.current.clearCache();
      }
    };
  }, [apiKey]);

  // Load thumbnail for a specific location
  const loadThumbnail = useCallback(async (location: PanoramaLocation) => {
    if (!panoramaApiRef.current) return;

    const key = createLocationKey(location);

    if (thumbnails.has(key) || thumbnailErrors.has(key)) {
      return;
    }

    setLoadingThumbnails(prev => new Set(prev).add(key));

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

      if (isMounted.current) {
        if (response.success && response.imageUrl) {
          setThumbnails(prev => new Map(prev).set(key, response.imageUrl!));
        } else {
          setThumbnailErrors(prev => new Set(prev).add(key));
        }
      }
    } catch (error) {
      console.error('Thumbnail load error:', error);
      if (isMounted.current) {
        setThumbnailErrors(prev => new Set(prev).add(key));
      }
    } finally {
      if (isMounted.current) {
        setLoadingThumbnails(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    }
  }, [thumbnailSettings, thumbnails, thumbnailErrors]);


  // Load all thumbnails in parallel for maximum speed
  const loadAllThumbnails = useCallback(async () => {
    const promises = locations.map(location => loadThumbnail(location));
    await Promise.all(promises);
  }, [locations, loadThumbnail]);

  // Toggle selection for AI analysis
  const toggleSelection = (key: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent opening detail view
    setSelectedForAnalysis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Select/Deselect all
  const selectAll = () => {
    const allKeys = new Set<string>();
    locations.forEach(loc => allKeys.add(createLocationKey(loc)));
    setSelectedForAnalysis(allKeys);
  };

  const deselectAll = () => {
    setSelectedForAnalysis(new Set());
  };

  // Run batch AI analysis
  const runBatchAiAnalysis = async () => {
    if (selectedForAnalysis.size === 0) {
      alert('Vyberte alespoň jedno panorama pro analýzu.');
      return;
    }

    setIsAiAnalyzing(true);
    setAiAnalysisProgress({ current: 0, total: selectedForAnalysis.size });
    const results = new Map<string, any>();

    let currentIndex = 0;

    for (const key of Array.from(selectedForAnalysis)) {
      const location = locations.find(loc => createLocationKey(loc) === key);
      if (!location || !panoramaApiRef.current) continue;

      currentIndex++;
      setAiAnalysisProgress({ current: currentIndex, total: selectedForAnalysis.size });

      try {
        // Fetch panorama image
        const panoImageResponse = await panoramaApiRef.current.fetchPanoramaImage(
          location.lon,
          location.lat,
          {
            width: 1024,
            height: 800,
            yaw: 0,
            pitch: 0,
            fov: 90
          }
        );

        if (!panoImageResponse.success || !panoImageResponse.imageUrl) {
          results.set(key, { error: 'Nepodařilo se načíst obrázek pro analýzu.' });
          continue;
        }

        // Convert to base64
        const blob = await fetch(panoImageResponse.imageUrl).then(r => r.blob());
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Call AI analysis API
        const response = await fetch('/api/analyze-property', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: dataUrl,
            coordinates: [location.lon, location.lat]
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          results.set(key, { error: errorData.error || 'AI analýza selhala.' });
          continue;
        }

        const result = await response.json();
        results.set(key, result);

      } catch (error) {
        console.error(`Chyba při AI analýze ${key}:`, error);
        results.set(key, { error: (error as Error).message });
      }
    }

    setAnalysisResults(results);
    setIsAiAnalyzing(false);
    setAiAnalysisProgress({ current: 0, total: 0 });
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

  const selectedCount = selectedForAnalysis.size;
  const analyzedCount = analysisResults.size;

  return (
    <div className={`panorama-gallery bg-dark-bg text-white flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold text-white">Galerie snímků</h2>
            <div className="text-sm text-gray-400">
              {locations.length} nalezených panoramat
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 transition-colors rounded"
              title="Zavřít galerii"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* AI Analysis Controls */}
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
              >
                Vybrat vše
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded transition-colors"
              >
                Zrušit výběr
              </button>
              <span className="text-sm text-gray-400">
                Vybráno: {selectedCount}/{locations.length}
              </span>
            </div>

            <button
              onClick={runBatchAiAnalysis}
              disabled={isAiAnalyzing || selectedCount === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed font-bold text-sm transition-colors rounded flex items-center gap-2"
            >
              {isAiAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Analyzuji... ({aiAnalysisProgress.current}/{aiAnalysisProgress.total})
                </>
              ) : (
                <>
                  🤖 Spustit AI analýzu vybraných ({selectedCount})
                </>
              )}
            </button>
          </div>

          {/* Progress Bar */}
          {isAiAnalyzing && (
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all duration-300"
                style={{ width: `${(aiAnalysisProgress.current / aiAnalysisProgress.total) * 100}%` }}
              />
            </div>
          )}

          {/* Results Summary */}
          {analyzedCount > 0 && !isAiAnalyzing && (
            <div className="text-sm text-gray-400 bg-gray-900 border border-gray-800 rounded p-2">
              ✅ Analyzováno: {analyzedCount} panoram
            </div>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {locations.map((location, index) => {
            const key = createLocationKey(location);
            const thumbnailUrl = thumbnails.get(key);
            const isLoading = loadingThumbnails.has(key);
            const hasError = thumbnailErrors.has(key);
            const isSelected = selectedForAnalysis.has(key);
            const analysisResult = analysisResults.get(key);

            return (
              <div
                key={`${location.lon}_${location.lat}_${index}`}
                className={`bg-dark-card overflow-hidden shadow-lg hover:shadow-electric-blue/25 transition-all cursor-pointer border-2 ${
                  isSelected ? 'border-green-500' : 'border-gray-800 hover:border-electric-blue/50'
                }`}
                onClick={() => setSelectedPanorama(location)}
              >
                {/* Thumbnail */}
                <div
                  className="relative bg-gray-900 flex items-center justify-center"
                  style={{
                    height: `${thumbnailSettings.height}px`,
                  }}
                >
                  {/* Selection Checkbox */}
                  <div
                    onClick={(e) => toggleSelection(key, e)}
                    className="absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 border-white bg-gray-900/80 flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
                  >
                    {isSelected && (
                      <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Analysis Status Badge */}
                  {analysisResult && (
                    <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded text-xs font-bold bg-green-600 text-white">
                      {analysisResult.error ? '❌ Chyba' : '✅ Analyzováno'}
                    </div>
                  )}

                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 border-2 border-electric-blue/20 border-t-electric-blue rounded-full animate-spin mb-2"></div>
                      <span className="text-xs text-gray-400">Načítám...</span>
                    </div>
                  ) : hasError ? (
                    <div className="flex flex-col items-center text-red-400">
                      <div className="text-3xl mb-2">⚠️</div>
                      <span className="text-xs">Chyba načtení</span>
                    </div>
                  ) : thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={`Panorama at ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <div className="text-3xl mb-2">🏞️</div>
                      <span className="text-xs">Čeká na načtení</span>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                    <div className="bg-electric-blue text-white px-3 py-1 text-sm font-medium rounded">
                      Otevřít detail
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 text-xs space-y-1">
                  <div className="text-gray-300 mb-1 font-mono">
                    📍 {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                  </div>
                  <div className="text-gray-400 font-mono">
                    📅 {new Date(location.date).toLocaleDateString()}
                  </div>

                  {/* Analysis Score */}
                  {analysisResult && !analysisResult.error && analysisResult.souhrn && (
                    <div className="pt-2 border-t border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Potenciál:</span>
                        <span className="font-bold text-yellow-400">
                          {analysisResult.souhrn.potencial_prodeje_skore}/100
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {locations.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4 opacity-50">🏞️</div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">Nebyly nalezeny žádné panoramy</h3>
            <p className="text-gray-500">Pro tuto oblast nebyly nalezeny žádné snímky.</p>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="flex-shrink-0 p-2 border-t border-gray-800 bg-dark-card text-xs text-gray-400 flex justify-between">
        <span>
          Načteno: {thumbnails.size}/{locations.length} |
          Načítání: {loadingThumbnails.size} |
          Chyb: {thumbnailErrors.size}
        </span>
        <span>
          {analyzedCount > 0 && `Analyzováno: ${analyzedCount}`}
        </span>
      </div>
    </div>
  );
};

export default PanoramaGallery;
