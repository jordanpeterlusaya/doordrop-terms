# DoorDrop Admin Website

This folder contains a standalone admin website that is separate from the Expo app.

## What it does

- Signs in with Firebase Authentication using email and password
- Reads live `orders`, `drivers`, and `users` collections from Firestore
- Provides three admin dashboards:
  - `Operations Dashboard` for dispatch, fleet, maps, and customer activity
  - `Financial Dashboard` for delivered revenue, pipeline value, and order money visibility
  - `Executive Dashboard` for leadership KPIs, watchlist insights, and recent business movement
- Uses OpenStreetMap through Leaflet for the live operations map
- Assigns drivers to orders
- Updates delivery statuses
- Uses simple Firebase email/password sign-in for admin access
- Gives every signed-in admin account access to all three dashboards

## Run locally

1. Start a static server from the repo root:

   ```bash
   npm run admin:serve
   ```

2. Open `http://localhost:4173`

3. Sign in with any Firebase email/password account from the same project

## Important Firebase setup

- Enable Email/Password in Firebase Authentication
- Add your deployed admin website domain in Firebase Authentication > Settings > Authorized domains
- Make sure Firestore rules allow the admin website to read and write `orders`, `drivers`, and `users`
- Mirror your desired admin access policy in Firestore security rules if you want server-side enforcement in addition to the client-side admin UI

## OpenStreetMap setup

- The live map now uses OpenStreetMap tiles through Leaflet
- No Google Maps API key is required
- The browser still needs internet access to load the map tiles
