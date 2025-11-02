# Vercel Deployment Guide

## Security-First Deployment

This project uses **Vercel Serverless Functions** to keep your API keys secure. Never expose sensitive API keys in frontend code!

## Environment Variables Setup

### In Vercel Dashboard (Production)

Go to: **Settings → Environment Variables**

Add these **server-side** variables (NO `REACT_APP_` prefix):

```
MAPY_API_KEY = <your_mapy_api_key_from_developer.mapy.com>
ANTHROPIC_API_KEY = <your_anthropic_api_key_from_console.anthropic.com>
```

Optional frontend variable (for development fallback):
```
REACT_APP_MAPY_API_KEY = <your_mapy_api_key>
```

**Note:** Never commit API keys to Git. Use your actual keys from:
- Mapy.cz API: https://developer.mapy.com/
- Anthropic API: https://console.anthropic.com/

### Environment Selection

When adding variables in Vercel:
- ✅ **Production** - Always enable
- ✅ **Preview** - Recommended (for testing PRs)
- ⚠️ **Development** - Optional (for local `vercel dev`)

## API Endpoints

Your app will have these secure endpoints:

- `https://your-domain.vercel.app/api/analyze-property`
- `https://your-domain.vercel.app/api/panorama-search`

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "feat: add secure serverless functions"
   git push
   ```

2. **Import to Vercel**
   - Go to https://vercel.com/new
   - Select your GitHub repository
   - Click "Import"

3. **Configure Environment Variables**
   - In project settings, go to "Environment Variables"
   - Add the variables listed above
   - Make sure to select the right environments

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app is live! 🚀

## Testing Serverless Functions Locally

Install Vercel CLI:
```bash
npm i -g vercel
```

Run locally:
```bash
vercel dev
```

This will run your serverless functions at `http://localhost:3000/api/*`

## Security Benefits

✅ API keys never exposed in browser
✅ Server-side only access
✅ Rate limiting possible
✅ Request validation
✅ CORS protection

## Troubleshooting

### Functions not working?
- Check Environment Variables are set correctly
- Make sure variable names don't have `REACT_APP_` prefix for server-side vars
- Redeploy after adding new variables

### CORS errors?
- The serverless functions include CORS headers
- Check if the request is going to `/api/*` endpoints

### API key errors in logs?
- Go to Vercel Dashboard → Your Project → Deployments
- Click on latest deployment → Functions
- Check function logs for detailed errors
