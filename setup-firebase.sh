#!/bin/bash

# 🔥 GeoWork Firebase Setup Script
# This script helps you configure Firebase after creating apps in the console

echo "🔥 GeoWork Firebase Setup"
echo "========================="
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "📋 This script will help you configure Firebase."
echo "❗ IMPORTANT: First complete steps 1-4 in FIREBASE_SETUP.md"
echo

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

echo "📝 Please provide your Firebase Web App configuration:"
echo "   (Get these from Firebase Console > Project Settings > General > Your apps)"
echo

# Get Firebase config from user
read -p "🔑 API Key: " API_KEY
read -p "📱 App ID: " APP_ID

# Validate inputs
if [ -z "$API_KEY" ] || [ -z "$APP_ID" ]; then
    echo "❌ API Key and App ID are required!"
    exit 1
fi

# Create .env.local file for React app
echo "📝 Creating .env.local for React app..."
cat > packages/web-admin/.env.local << EOF
# 🔥 FIREBASE CONFIGURATION
VITE_FIREBASE_API_KEY=$API_KEY
VITE_FIREBASE_AUTH_DOMAIN=geowork-time-tracker.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=geowork-time-tracker
VITE_FIREBASE_STORAGE_BUCKET=geowork-time-tracker.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=681589331619
VITE_FIREBASE_APP_ID=$APP_ID

# 🛠️ DEVELOPMENT SETTINGS
VITE_USE_EMULATORS=false
VITE_APP_ENVIRONMENT=development
EOF

echo "✅ React app configured!"

# Check for Android config file
if [ ! -f "packages/mobile/android/app/google-services.json" ]; then
    echo "⚠️  Don't forget to:"
    echo "   1. Download google-services.json from Firebase Console"
    echo "   2. Place it in packages/mobile/android/app/"
else
    echo "✅ Android app already configured!"
fi

echo
echo "🧪 Testing React app configuration..."
cd packages/web-admin

# Test if the config is valid
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ React app builds successfully!"
else
    echo "⚠️  React app build failed. Check your configuration."
fi

cd ../..

echo
echo "🎉 Firebase setup completed!"
echo
echo "🚀 Next steps:"
echo "   1. Test React app: cd packages/web-admin && npm run dev"
echo "   2. Test Flutter app: cd packages/mobile && flutter run"
echo "   3. Create test users in Firebase Console > Authentication"
echo
echo "📖 See FIREBASE_SETUP.md for detailed instructions." 