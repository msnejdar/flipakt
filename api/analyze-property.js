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
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageUrl.split(',')[1],
              }
            },
            {
              type: 'text',
              text: `Jsi expert na analýzu nemovitostí pro realitní investory. Analyzuj obrázek nemovitosti a posuď její potenciál pro akvizici. Zaměř se na známky zanedbání. Vrať odpověď POUZE ve formátu JSON, bez jakéhokoliv dalšího textu, s následující strukturou a hodnocením v ČEŠTINĚ.

Checklist pro posouzení (hodnoť na stupnici 0-10, kde 10 je nejhorší stav):
- stav_fasady (praskliny, opadávající omítka, špína, plíseň)
- stav_oken_dveri (rozbitá okna, poškozené rámy, staré dveře)
- stav_strechy (chybějící tašky, poškození, provizorní opravy)
- okoli_nemovitosti (zanedbaný pozemek, nepořádek, poškozený plot)
- celkovy_dojem (celková zanedbanost v porovnání s okolím)

Výstupní JSON struktura:
{
  "checklist": {
    "stav_fasady": number,
    "stav_oken_dveri": number,
    "stav_strechy": number,
    "okoli_nemovitosti": number,
    "celkovy_dojem": number
  },
  "souhrn": {
    "pozitiva": string[],
    "negativa": string[],
    "doporuceni": string,
    "potencial_prodeje_skore": number // 0-100
  },
  "stari_a_styl": string
}`
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
