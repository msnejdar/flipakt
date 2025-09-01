import React, { useState } from 'react';

// Simple demo component to test panorama functionality
const PanoramaDemo: React.FC = () => {
  const [showDemo, setShowDemo] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testCoords = {
    lon: 14.4378,
    lat: 50.0755,
    yaw: 0,
    pitch: 0,
    fov: 90,
    width: 800,
    height: 600
  };

  const generatePanoramaUrl = () => {
    const API_KEY = process.env.REACT_APP_MAPY_API_KEY;
    if (!API_KEY) {
      alert('API key not found!');
      return;
    }

    const params = new URLSearchParams({
      lon: testCoords.lon.toString(),
      lat: testCoords.lat.toString(),
      width: testCoords.width.toString(),
      height: testCoords.height.toString(),
      yaw: testCoords.yaw.toString(),
      pitch: testCoords.pitch.toString(),
      fov: testCoords.fov.toString(),
      apikey: API_KEY
    });

    const url = `https://api.mapy.cz/v1/static/pano?${params.toString()}`;
    setImageUrl(url);
    setLoading(true);
    
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  };

  if (!showDemo) {
    return (
      <div className="p-4">
        <button
          onClick={() => setShowDemo(true)}
          className="px-4 py-2 bg-electric-blue text-white rounded-lg hover:bg-electric-blue/80"
        >
          🏞️ Test Panorama Demo
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col">
      <div className="p-4 border-b border-electric-blue/20 flex justify-between items-center">
        <h2 className="text-xl font-bold text-electric-blue">Panorama Demo</h2>
        <button
          onClick={() => setShowDemo(false)}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Close
        </button>
      </div>

      <div className="flex-1 p-4">
        <div className="mb-4">
          <p className="text-gray-300 mb-2">
            Test location: Prague Old Town Square ({testCoords.lat}, {testCoords.lon})
          </p>
          <button
            onClick={generatePanoramaUrl}
            className="px-4 py-2 bg-electric-blue text-white rounded hover:bg-electric-blue/80"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load Panorama'}
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-center" style={{ minHeight: '400px' }}>
          {loading ? (
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-electric-blue/20 border-t-electric-blue rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-300">Loading panorama...</p>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt="Panorama"
              className="max-w-full max-h-full rounded-lg shadow-lg"
              onLoad={() => console.log('✅ Panorama loaded successfully')}
              onError={(e) => {
                console.error('❌ Failed to load panorama:', e);
                alert('Failed to load panorama. Check console for details.');
              }}
            />
          ) : (
            <p className="text-gray-400">Click "Load Panorama" to test the API</p>
          )}
        </div>

        {imageUrl && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 break-all">URL: {imageUrl}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PanoramaDemo;