# PropertyScout AI

A modern landing page for PropertyScout AI - an AI-powered real estate acquisition tool that analyzes panoramic street views to identify properties with high acquisition potential.

## Features

- **Modern Design**: Dark theme with electric blue/purple accents and glassmorphism effects
- **Interactive Map**: Integration with Mapy.cz for Czech Republic property analysis
- **Responsive**: Works on all screen sizes with smooth animations
- **AI-Focused**: Showcases polygon drawing, AI analysis, and bulk processing capabilities

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Create a `.env.local` file with your API keys:
   ```bash
   REACT_APP_MAPY_API_KEY=your_mapy_api_key_here
   REACT_APP_ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```
   - Get Mapy.cz API key from: https://developer.mapy.com/
   - Get Anthropic API key from: https://console.anthropic.com/

4. Start the development server:
   ```bash
   npm start
   ```

## Technologies Used

- React 18 with TypeScript
- Tailwind CSS for styling
- Mapy.cz API for interactive maps
- Custom animations and transitions

## Map Integration

The application integrates with Mapy.cz API to provide:
- Interactive map centered on Czech Republic (coordinates: 49.75, 15.5)
- Fullscreen map view with smooth transitions
- Floating toolbar for drawing and analysis
- Error handling and loading states

To use the map functionality, click "Start Free Analysis" on the landing page.

## Available Scripts

### `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000)

### `npm run build`
Builds the app for production to the `build` folder

### `npm test`
Launches the test runner in interactive watch mode

## Deployment on Vercel

### Quick Deploy

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Vercel will automatically detect the Create React App setup
6. **IMPORTANT**: Add environment variables in Vercel dashboard (Settings → Environment Variables):

   **Server-side only (secure):**
   - `MAPY_API_KEY` = your_mapy_api_key
   - `ANTHROPIC_API_KEY` = your_anthropic_api_key

   **Optional - for development fallback:**
   - `REACT_APP_MAPY_API_KEY` = your_mapy_api_key

   See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for detailed instructions.

7. Click "Deploy"

### Manual Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

The project includes a `vercel.json` configuration file that handles:
- Build command: `npm run build`
- Output directory: `build`
- API routes for serverless functions (`/api/*`)
- SPA routing with proper rewrites

### Serverless API Endpoints

The app uses Vercel Serverless Functions to keep API keys secure:

- **POST `/api/analyze-property`** - Claude AI property analysis
  - Body: `{ imageUrl: string, coordinates: [number, number] }`
  - Returns: Property condition analysis with AI insights

- **POST `/api/panorama-search`** - Mapy.cz panorama search
  - Body: `{ lat: number, lon: number, radius?: number }`
  - Returns: Nearby panorama locations

These endpoints keep your API keys server-side and secure.

## Note

This is a demo application showcasing modern web development techniques. The actual AI analysis functionality would require backend integration with computer vision services.