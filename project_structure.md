geo_work/
├── packages/
│   ├── mobile/                 # Flutter app (Dart)
│   │   ├── lib/
│   │   ├── android/
│   │   ├── ios/
│   │   └── pubspec.yaml
│   ├── web-admin/             # React admin dashboard (TypeScript)
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.ts
│   ├── functions/             # Firebase Cloud Functions (TypeScript)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/                # Shared types and utilities
│       ├── types/             # TypeScript interfaces
│       ├── schemas/           # JSON schemas for data models
│       └── dart-models/       # Generated Dart models
├── firebase.json              # Firebase configuration
├── firestore.rules           # Database security rules
├── package.json              # Root workspace configuration
├── .gitignore
├── .github/
│   └── workflows/            # CI/CD pipelines
├── docs/                     # Your existing documentation
└── README.md 