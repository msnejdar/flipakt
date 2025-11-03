import { PanoramaImage, PanoramaApiResponse, ImageCache, PanoramaControlsState } from '../types/panoramaViewer';

// Enhanced API utility for Mapy.cz Static Panorama API
export class PanoramaApiService {
  private baseUrl = 'https://api.mapy.cz/v1/static/pano';
  private cache: ImageCache = {};
  private cacheTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(private apiKey: string) {}

  // Generate panorama image URL
  generatePanoramaUrl(
    lon: number,
    lat: number,
    options: Partial<PanoramaControlsState> = {}
  ): string {
    // Mapy.cz Static Panorama API format
    // IMPORTANT: Max dimensions are 1024x1024 pixels!
    // yaw: 0–2π radians (or "auto"/"point")
    // pitch: ±π radians
    // fov: π/2 to π/20 radians (API is VERY strict about these limits!)

    const width = Math.min(options.width || 1024, 1024); // Max 1024px!
    const height = Math.min(options.height || 800, 1024); // Max 1024px!

    // Convert degrees to radians for yaw (0-360° → 0-2π)
    const yawDegrees = options.yaw !== undefined ? options.yaw : 0;
    const yawRadians = (yawDegrees * Math.PI) / 180;

    // Convert degrees to radians for pitch (-90 to 90° → -π to π)
    const pitchDegrees = options.pitch !== undefined ? options.pitch : 0;
    const pitchRadians = (pitchDegrees * Math.PI) / 180;

    // Convert FOV degrees to radians
    // CRITICAL: API rejects values >= Math.PI/2, so we cap at 1.57 (just under π/2)
    const fovDegrees = options.fov || 90;
    const fovRadians = (fovDegrees * Math.PI) / 180;
    const minFov = Math.PI / 20; // ~0.157 radians (9°)
    const maxFov = 1.57; // Safely under π/2 (1.5708), API strictly rejects >= π/2
    const safeFov = Math.min(Math.max(fovRadians, minFov), maxFov);

    const params = new URLSearchParams({
      lon: lon.toString(),
      lat: lat.toString(),
      width: width.toString(),
      height: height.toString(),
      yaw: yawRadians.toFixed(4),
      pitch: pitchRadians.toFixed(4),
      fov: safeFov.toFixed(4),
      apikey: this.apiKey
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  // Generate cache key for URL
  private getCacheKey(url: string): string {
    return btoa(url).replace(/[+/=]/g, '');
  }

  // Check if cache entry is valid
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTimeout;
  }

  // Fetch panorama image with caching
  async fetchPanoramaImage(
    lon: number,
    lat: number,
    options: Partial<PanoramaControlsState> = {}
  ): Promise<PanoramaApiResponse> {
    const url = this.generatePanoramaUrl(lon, lat, options);
    const cacheKey = this.getCacheKey(url);

    // Check cache first
    if (this.cache[cacheKey] && this.isCacheValid(this.cache[cacheKey].timestamp)) {
      console.log('🎯 Panorama cache hit:', cacheKey);
      return {
        success: true,
        imageUrl: this.cache[cacheKey].url
      };
    }

    try {
      console.log('🌐 Fetching panorama:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Create blob URL for caching
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Store in cache
      this.cache[cacheKey] = {
        url: blobUrl,
        timestamp: Date.now(),
        blob
      };

      console.log('✅ Panorama fetched successfully');
      
      return {
        success: true,
        imageUrl: blobUrl
      };

    } catch (error) {
      console.error('❌ Panorama fetch failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Download panorama image
  async downloadPanoramaImage(
    lon: number,
    lat: number,
    options: Partial<PanoramaControlsState> = {},
    filename?: string
  ): Promise<boolean> {
    try {
      const response = await this.fetchPanoramaImage(lon, lat, options);
      
      if (!response.success || !response.imageUrl) {
        throw new Error(response.error || 'Failed to fetch image');
      }

      // Create download link
      const link = document.createElement('a');
      link.href = response.imageUrl;
      link.download = filename || `panorama_${lon}_${lat}_${Date.now()}.jpg`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('💾 Panorama downloaded successfully');
      return true;

    } catch (error) {
      console.error('❌ Panorama download failed:', error);
      return false;
    }
  }

  // Batch download multiple panoramas
  async batchDownloadPanoramas(
    locations: Array<{ lon: number; lat: number }>,
    options: Partial<PanoramaControlsState> = {},
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (let i = 0; i < locations.length; i++) {
      const { lon, lat } = locations[i];
      
      try {
        await this.downloadPanoramaImage(
          lon, 
          lat, 
          options, 
          `panorama_batch_${i + 1}_${lon}_${lat}.jpg`
        );
        success++;
      } catch (error) {
        console.error(`Failed to download panorama ${i + 1}:`, error);
        failed++;
      }

      if (onProgress) {
        onProgress(i + 1, locations.length);
      }

      // Add small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return { success, failed };
  }

  // Create panorama image object
  createPanoramaImage(
    id: string,
    lon: number,
    lat: number,
    date: string,
    options: Partial<PanoramaControlsState> = {}
  ): PanoramaImage {
    return {
      id,
      lon,
      lat,
      date,
      yaw: options.yaw || 0,
      pitch: options.pitch || 0,
      fov: options.fov || 90,
      width: options.width || 1200,
      height: options.height || 800,
      url: this.generatePanoramaUrl(lon, lat, options),
      loading: false
    };
  }

  // Clean up old cache entries
  cleanupCache(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach(key => {
      if (!this.isCacheValid(this.cache[key].timestamp)) {
        // Revoke blob URL to free memory
        URL.revokeObjectURL(this.cache[key].url);
        delete this.cache[key];
      }
    });
  }

  // Clear all cache
  clearCache(): void {
    Object.values(this.cache).forEach(entry => {
      URL.revokeObjectURL(entry.url);
    });
    this.cache = {};
  }

  // Get cache statistics
  getCacheStats(): { count: number; totalSize: number } {
    const count = Object.keys(this.cache).length;
    let totalSize = 0;
    
    Object.values(this.cache).forEach(entry => {
      if (entry.blob) {
        totalSize += entry.blob.size;
      }
    });

    return { count, totalSize };
  }
}