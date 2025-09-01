// TypeScript declarations for Mapy.cz Panorama API podle oficiální dokumentace
interface IPanoramaExistsOpts {
  /** Wgs84 longitude coordinate */
  lon: number;
  /** Wgs84 latitude coordinate  */
  lat: number;
  /** API key */
  apiKey: string;
  /** Search area radius [m] */
  radius?: number;
}

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

declare global {
  interface Window {
    Panorama?: {
      panoramaExists: (options: IPanoramaExistsOpts) => Promise<IPanoramaExistsOutput>;
      panoramaFromPosition: (options: {
        parent?: HTMLElement;
        lon: number;
        lat: number;
        yaw: string | number;
        apiKey: string;
        showNavigation?: boolean;
        radius?: number;
      }) => Promise<{
        error?: string;
        panoramaId?: string;
        [key: string]: any;
      }>;
    };
  }
}

export {};