// Enhanced types for panorama viewer functionality
export interface PanoramaImage {
  id: string;
  lon: number;
  lat: number;
  yaw: number;
  pitch: number;
  fov: number;
  width: number;
  height: number;
  url: string;
  date: string;
  loading?: boolean;
  error?: string;
}

export interface PanoramaDownloadOptions {
  width: number;
  height: number;
  quality: number;
  format: 'jpg' | 'png';
}

export interface PanoramaViewerSettings {
  defaultYaw: number;
  defaultPitch: number;
  defaultFov: number;
  defaultWidth: number;
  defaultHeight: number;
  maxWidth: number;
  maxHeight: number;
  minFov: number;
  maxFov: number;
  downloadFormats: string[];
}

export interface PanoramaLocation {
  lon: number;
  lat: number;
  date: string;
}

export interface PanoramaApiResponse {
  success: boolean;
  error?: string;
  imageUrl?: string;
}

export interface ImageCache {
  [key: string]: {
    url: string;
    timestamp: number;
    blob?: Blob;
  };
}

export interface PanoramaControlsState {
  yaw: number;
  pitch: number;
  fov: number;
  width: number;
  height: number;
}

export const PANORAMA_DEFAULTS: PanoramaViewerSettings = {
  defaultYaw: 0,
  defaultPitch: 0,
  defaultFov: 90,
  defaultWidth: 1024, // Mapy.cz API max is 1024px!
  defaultHeight: 800,
  maxWidth: 1024, // Mapy.cz API max is 1024px!
  maxHeight: 1024, // Mapy.cz API max is 1024px!
  minFov: 10,
  maxFov: 120,
  downloadFormats: ['jpg', 'png']
};