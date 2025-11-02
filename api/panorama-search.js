// Vercel Serverless Function for Mapy.cz Panorama Search
// This keeps your Mapy.cz API key secure on the server side

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { lat, lon, radius = 50 } = req.body;

  if (!lat || !lon) {
    return res.status(400).json({
      error: 'Missing required fields: lat and lon'
    });
  }

  const MAPY_API_KEY = process.env.MAPY_API_KEY;

  if (!MAPY_API_KEY) {
    console.error('MAPY_API_KEY not configured');
    return res.status(500).json({
      error: 'API key not configured'
    });
  }

  try {
    const url = `https://api.mapy.cz/v1/panorama/search?lat=${lat}&lon=${lon}&radius=${radius}`;

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': MAPY_API_KEY
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Mapy.cz API error:', error);
      return res.status(response.status).json({
        error: 'Panorama search failed',
        details: error
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Panorama search error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
