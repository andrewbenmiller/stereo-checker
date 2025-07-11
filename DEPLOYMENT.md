# Deployment Instructions for stereochecker.gluefactorymusic.com

## Option 1: Deploy to Netlify (Recommended)

### Using Netlify CLI

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify:**
   ```bash
   netlify login
   ```

3. **Initialize the site:**
   ```bash
   netlify init
   ```

4. **Deploy to production:**
   ```bash
   netlify deploy --prod
   ```

5. **Set custom domain:**
   - Go to your Netlify dashboard
   - Navigate to Site settings > Domain management
   - Add custom domain: `stereochecker.gluefactorymusic.com`
   - Configure DNS settings as instructed by Netlify

### Using Netlify Web Interface

1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Drag and drop the `build` folder to deploy
3. Set custom domain to `stereochecker.gluefactorymusic.com`

## Option 2: Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Set custom domain:**
   - Go to your Vercel dashboard
   - Add custom domain: `stereochecker.gluefactorymusic.com`

## Option 3: Traditional Hosting

1. Upload the contents of the `build` folder to your web server
2. Configure your web server to serve `index.html` for all routes
3. Set up DNS for `stereochecker.gluefactorymusic.com` to point to your server

## Build Commands

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test locally
npm start
```

## DNS Configuration

For the custom domain `stereochecker.gluefactorymusic.com`, you'll need to:

1. Add a CNAME record pointing to your hosting provider
2. For Netlify: Point to `your-site-name.netlify.app`
3. For Vercel: Point to `your-site-name.vercel.app`

## Environment Variables

No environment variables are required for this application.

## Notes

- The app is configured for client-side routing
- All routes redirect to `index.html` for SPA functionality
- The build folder contains the optimized production files 