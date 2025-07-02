@echo off
echo 🔥 GeoWork Firebase Setup
echo =========================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Please run this script from the project root directory
    pause
    exit /b 1
)

echo 📋 This script will help you configure Firebase.
echo ❗ IMPORTANT: First complete steps 1-4 in FIREBASE_SETUP.md
echo.

REM Check if Firebase CLI is available
firebase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Firebase CLI not found. Please install it first:
    echo    npm install -g firebase-tools
    pause
    exit /b 1
)

echo 📝 Please provide your Firebase Web App configuration:
echo    (Get these from Firebase Console ^> Project Settings ^> General ^> Your apps)
echo.

REM Get Firebase config from user
set /p API_KEY="🔑 API Key: "
set /p APP_ID="📱 App ID: "

REM Validate inputs
if "%API_KEY%"=="" (
    echo ❌ API Key is required!
    pause
    exit /b 1
)
if "%APP_ID%"=="" (
    echo ❌ App ID is required!
    pause
    exit /b 1
)

REM Create .env.local file for React app
echo 📝 Creating .env.local for React app...
(
echo # 🔥 FIREBASE CONFIGURATION
echo VITE_FIREBASE_API_KEY=%API_KEY%
echo VITE_FIREBASE_AUTH_DOMAIN=geowork-time-tracker.firebaseapp.com
echo VITE_FIREBASE_PROJECT_ID=geowork-time-tracker
echo VITE_FIREBASE_STORAGE_BUCKET=geowork-time-tracker.appspot.com
echo VITE_FIREBASE_MESSAGING_SENDER_ID=681589331619
echo VITE_FIREBASE_APP_ID=%APP_ID%
echo.
echo # 🛠️ DEVELOPMENT SETTINGS
echo VITE_USE_EMULATORS=false
echo VITE_APP_ENVIRONMENT=development
) > packages\web-admin\.env.local

echo ✅ React app configured!

REM Check for Android config file
if not exist "packages\mobile\android\app\google-services.json" (
    echo ⚠️  Don't forget to:
    echo    1. Download google-services.json from Firebase Console
    echo    2. Place it in packages\mobile\android\app\
) else (
    echo ✅ Android app already configured!
)

echo.
echo 🧪 Testing React app configuration...
cd packages\web-admin
npm run build >nul 2>&1
if errorlevel 1 (
    echo ⚠️  React app build failed. Check your configuration.
) else (
    echo ✅ React app builds successfully!
)
cd ..\..

echo.
echo 🎉 Firebase setup completed!
echo.
echo 🚀 Next steps:
echo    1. Test React app: cd packages\web-admin ^&^& npm run dev
echo    2. Test Flutter app: cd packages\mobile ^&^& flutter run
echo    3. Create test users in Firebase Console ^> Authentication
echo.
echo 📖 See FIREBASE_SETUP.md for detailed instructions.
pause 