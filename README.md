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
   - Update the `.env` file with your Mapy.cz API key:
   ```bash
   REACT_APP_MAPY_API_KEY=your_actual_api_key_here
   ```
   - Get your API key from: https://developer.mapy.com/

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

## Note

This is a demo application showcasing modern web development techniques. The actual AI analysis functionality would require backend integration with computer vision services.