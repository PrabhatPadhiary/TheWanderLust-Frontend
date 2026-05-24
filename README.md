# TheWanderLust - Frontend

A travel destination discovery and trip planning app built with Angular 19.

## Live URLs

| Service | URL |
|---------|-----|
| Frontend (Render Static Site) | https://thewanderlust-frontend.onrender.com |
| Backend API (Render Web Service) | https://wanderlust-backend-8qn5.onrender.com/api |
| Firebase Project | https://console.firebase.google.com/project/wanderlust-35cd9 |

## Tech Stack

- **Framework:** Angular 19.1.6
- **UI:** Angular Material, Bootstrap 5, GSAP (animations)
- **Auth:** Firebase Authentication (Google sign-in via popup)
- **Maps:** Google Maps Places API (autocomplete, place details)
- **Hosting:** Render (static site)
- **Backend:** .NET Web API on Render

## Project Structure

```
src/app/
├── components/
│   ├── landingpage/          # Home page with search + animated showcase
│   ├── destination/          # Destination detail page (food, stays, tourism)
│   ├── place-detail-panel/   # Slide-out panel for place details
│   ├── auth-gate-modal/      # Login with Google / Continue as Guest modal
│   └── trip-planner/         # Trip planning page (WIP)
├── services/
│   ├── auth.service.ts       # Firebase Google auth (returns ID token)
│   └── destination.service.ts # Backend API calls for destinations
├── models/
│   └── destination.model.ts  # TypeScript interfaces for API responses
└── pipes/
    └── safe.pipe.ts          # DomSanitizer pipe for iframe URLs
```

## Environment Files

Angular uses file replacement at build time:

| File | Used When | API URL |
|------|-----------|---------|
| `environment.development.ts` | `ng serve` (local dev) | `http://localhost:5273/api` |
| `environment.ts` | `ng build` (production/Render) | `https://wanderlust-backend-8qn5.onrender.com/api` |

Both files contain the same Firebase config. The file replacement is configured in `angular.json` under `configurations.development.fileReplacements`.

## API Keys & Security

### Firebase Config (committed, public)

The Firebase client config (apiKey, authDomain, projectId, etc.) is **public by design**. These are client-side identifiers, not secrets. Security is enforced by:
- Firebase Authentication rules
- Backend verification of Firebase ID tokens via `FirebaseAuth.DefaultInstance.VerifyIdTokenAsync()`

### Google Maps API Key (committed, public)

The Maps JavaScript API key in `index.html` is restricted to specific domains in the Google Cloud Console. It's a client-side key and is visible in the browser regardless.

### What IS secret (not in this repo)

- Firebase Admin SDK credentials (on the backend only)
- Backend database connection strings
- Any server-side secrets

## Authentication Flow

1. User clicks "Login with Google" in the auth gate modal
2. Firebase `signInWithPopup` opens Google account picker
3. User selects account → Firebase returns an ID token
4. Frontend sends token to `POST /api/Auth/login`
5. Backend verifies token with Firebase Admin SDK, creates/finds user, returns user object
6. Frontend navigates to trip planner with user data

**Firebase Console setup required:** Authentication → Sign-in method → Google → Enabled

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server (uses environment.development.ts → localhost:5273 API)
ng serve

# Build for production (uses environment.ts → Render API)
ng build
```

The backend needs to be running locally on port 5273 for dev mode, or you can temporarily point `environment.development.ts` to the Render backend URL.

## Deployment (Render)

This is deployed as a **Static Site** on Render:

- **Repo:** PrabhatPodhiary/TheWanderLust-Frontend
- **Branch:** main
- **Build command:** `ng build`
- **Publish directory:** `dist/the-wander-lust-ui/browser`

Render's Environment Variables panel is **not used** for this static site — all config is baked into the JS bundle at build time via the environment files.

## Third-Party Services

| Service | Purpose | Console |
|---------|---------|---------|
| Firebase (wanderlust-35cd9) | Google OAuth authentication | [Firebase Console](https://console.firebase.google.com/project/wanderlust-35cd9) |
| Google Cloud | Maps JavaScript API + Places API | [Cloud Console](https://console.cloud.google.com) |
| Render | Frontend static hosting + Backend hosting | [Render Dashboard](https://dashboard.render.com) |

## Notes

- The app uses GSAP ScrollTrigger for landing page animations with a pinned hero section
- Google Places Autocomplete is used for destination search (filtered to localities/states/countries)
- The trip planner page is a placeholder — will be built out later
- `package-lock.json` is committed to ensure consistent installs across environments
