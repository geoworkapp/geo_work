# 🔥 Firebase Setup Guide for GeoWork Time Tracker

## ✅ Completed Steps
- [x] Firebase project "geowork-time-tracker" created
- [x] Firestore security rules deployed
- [x] Configuration files prepared
- [x] Environment variables template created

## 🎯 Remaining Steps

### 1. 📱 Create Firebase Apps

**A) Web App (Admin Dashboard):**
1. Go to [Firebase Console](https://console.firebase.google.com/project/geowork-time-tracker)
2. Click **"Add app"** → **Web** `</>`
3. App nickname: `GeoWork Admin Dashboard`
4. ✅ Check **"Also set up Firebase Hosting"**
5. Click **"Register app"**
6. **COPY THE CONFIG VALUES** (you'll need these!)

**B) Android App (Mobile):**
1. Click **"Add app"** → **Android** 
2. Package name: `com.yourcompany.geowork.mobile`
3. App nickname: `GeoWork Mobile`
4. Click **"Register app"**
5. **Download `google-services.json`** → Place in `packages/mobile/android/app/`

### 2. 🔐 Enable Authentication
1. Go to **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. Save

### 3. 🗃️ Create Firestore Database
1. Go to **Firestore Database** → **Create database**
2. Start in **Test mode** (rules are already deployed)
3. Choose location: **europe-west1** (for European market)
4. Click **Done**

### 4. ⚡ Enable Cloud Functions
1. Go to **Functions** → **Get started**
2. Follow the setup prompts
3. Choose **europe-west1** region

### 5. 🔧 Configure React App

**Create `.env.local` file in `packages/web-admin/`:**

```bash
# Copy from .env.example and fill with your values from Firebase Console
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=geowork-time-tracker.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=geowork-time-tracker
VITE_FIREBASE_STORAGE_BUCKET=geowork-time-tracker.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=681589331619
VITE_FIREBASE_APP_ID=your_app_id_here

# Development settings
VITE_USE_EMULATORS=false
VITE_APP_ENVIRONMENT=development
```

### 6. 📱 Configure Flutter App

**Place Firebase config files:**
- `google-services.json` → `packages/mobile/android/app/`
- `GoogleService-Info.plist` → `packages/mobile/ios/Runner/` (when ready for iOS)

## 🧪 Testing Setup

### Test React App:
```bash
cd packages/web-admin
npm run dev
# Visit http://localhost:5173
# Try login with demo credentials (will fail until Firebase is configured)
```

### Test Flutter App:
```bash
cd packages/mobile
flutter run
# Try login with demo credentials (will fail until Firebase is configured)
```

## 🎯 Next Steps After Setup

1. **Create test users** in Firebase Authentication
2. **Test login/logout** functionality
3. **Verify Firestore security rules** are working
4. **Start Phase 2 development**: Employee Management & Job Sites

## 🆘 Troubleshooting

**Common Issues:**
- **"Missing API key"**: Check `.env.local` file exists and has correct values
- **"Project not found"**: Verify project ID matches in all config files
- **"Network error"**: Check Firebase services are enabled
- **"Permission denied"**: Verify Firestore rules are deployed correctly

**Get Help:**
- Firebase Console: https://console.firebase.google.com/project/geowork-time-tracker
- Firebase Documentation: https://firebase.google.com/docs

---

📍 **Current Project Status:** Firebase infrastructure ready, waiting for app configuration! 