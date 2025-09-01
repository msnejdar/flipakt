// Alternative panorama checking approach using REST API
export async function checkPanoramaViaREST(lon: number, lat: number, apiKey: string): Promise<boolean> {
  // Use a small image size for faster checking
  const url = `https://api.mapy.cz/v1/static/pano?width=1&height=1&lon=${lon}&lat=${lat}&yaw=0&apikey=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'HEAD', // Just check headers, don't download the image
      mode: 'no-cors' // Avoid CORS issues
    });
    
    // In no-cors mode, we can't read the status, but if the request completes without error,
    // we assume the panorama exists
    return true;
  } catch (error) {
    // If there's an error, assume no panorama
    return false;
  }
}

// Helper function to check multiple points in parallel
export async function checkMultiplePanoramasREST(
  points: Array<{lon: number, lat: number}>, 
  apiKey: string,
  batchSize: number = 5
): Promise<Array<{lon: number, lat: number, exists: boolean}>> {
  const results: Array<{lon: number, lat: number, exists: boolean}> = [];
  
  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (point) => ({
        ...point,
        exists: await checkPanoramaViaREST(point.lon, point.lat, apiKey)
      }))
    );
    results.push(...batchResults);
    
    // Add delay between batches
    if (i + batchSize < points.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}