#!/bin/bash

echo "Building the React app..."
npm run build

echo "Build completed successfully!"
echo ""
echo "To deploy to stereochecker.gluefactorymusic.com:"
echo ""
echo "1. Install Netlify CLI: npm install -g netlify-cli"
echo "2. Login to Netlify: netlify login"
echo "3. Initialize site: netlify init"
echo "4. Deploy: netlify deploy --prod"
echo ""
echo "Or use the Netlify web interface:"
echo "1. Go to https://app.netlify.com"
echo "2. Drag and drop the 'build' folder"
echo "3. Set custom domain to stereochecker.gluefactorymusic.com"
echo ""
echo "The build folder is ready for deployment!" 