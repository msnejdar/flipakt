// Vercel Serverless Function for Claude AI Analysis
// This keeps your Anthropic API key secure on the server side

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers for your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { imageUrl, coordinates } = req.body;

  if (!imageUrl || !coordinates) {
    return res.status(400).json({
      error: 'Missing required fields: imageUrl and coordinates'
    });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({
      error: 'API key not configured'
    });
  }

  try {
    // Call Anthropic Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: imageUrl
              }
            },
            {
              type: 'text',
              text: `Analyze this property image for real estate acquisition potential. Focus on:
1. Overall condition (excellent, good, fair, poor, neglected)
2. Visible maintenance issues
3. Signs of vacancy or disrepair
4. Renovation needs
5. Acquisition potential score (0-100)

Provide analysis in JSON format with these fields:
- condition: string
- confidence: number (0-1)
- issues: string[]
- recommendation: string
- acquisitionScore: number (0-100)
- estimatedRenovationCost: number (CZK)

Coordinates: ${coordinates[0]}, ${coordinates[1]}`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return res.status(response.status).json({
        error: 'AI analysis failed',
        details: error
      });
    }

    const data = await response.json();

    // Extract JSON from Claude's response
    const textContent = data.content.find(c => c.type === 'text')?.text || '{}';

    // Try to parse JSON from the response
    let analysis;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
      console.error('Failed to parse Claude response:', e);
      analysis = {
        condition: 'unknown',
        confidence: 0.5,
        issues: ['Analysis parsing failed'],
        recommendation: textContent,
        acquisitionScore: 50,
        estimatedRenovationCost: 0
      };
    }

    // Return the analysis with coordinates
    return res.status(200).json({
      coordinates,
      ...analysis,
      imageUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
