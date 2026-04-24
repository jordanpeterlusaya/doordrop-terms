# DoorDropDrive

Driver-facing Expo app for DoorDrop.

## What it does

- Driver sign in and registration with Firebase Authentication
- Vehicle registration stored in the shared Firebase project
- Live foreground GPS updates written to Firestore
- Open order feed for drivers
- Driver order acceptance and trip status progression
- Shared live tracking fields for the customer app

## Run

1. Install dependencies in this folder:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm start
   ```

The app uses the same Firebase project configuration as the main DoorDrop customer app.
