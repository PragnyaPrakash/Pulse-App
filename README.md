# Pulse

Pulse is a quiet little companion app for staying connected with someone who matters.

The idea is simple: instead of constant texting or noisy notifications, Pulse gives two people a lightweight way to feel each other's presence. Once paired, each person can see whether their partner is active, send a soft "nudge," and review recent activity in a simple timeline. There is also an SOS action built in for urgent moments.

## What It Does

- Pairs two devices using a short 6-character device ID
- Syncs partner presence in near real time using Firebase Realtime Database
- Sends instant nudges between paired users
- Shows recent partner activity in a clean timeline view
- Includes an SOS flow for emergency use
- Stores pairing data locally with AsyncStorage

## Built With

- React Native
- Expo
- TypeScript
- Firebase Realtime Database
- AsyncStorage
- React Native Reanimated
- React Native SVG

## Why I Built It

Pulse was designed as a more subtle form of connection. Not every relationship needs a chat feed or a heavy social layer. Sometimes just knowing the other person is around, or being able to send a tiny signal, is enough.

The focus of this project was keeping the interaction gentle, quick, and visually calm while still making the realtime layer reliable enough to feel personal.

## Project Structure

```text
PulseApp/
|- App.tsx
|- components/
|- constants/
|- services/
|- assets/
|- plugins/
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the Expo app

```bash
npm start
```

### 3. Run it on a device or emulator

- Android: `npm run android`
- iOS: `npm run ios`
- Web: `npm run web`

## Firebase Setup

This project uses Firebase Realtime Database for presence, nudges, and history.

Update the Firebase config in [`services/FirebaseService.ts`](./services/FirebaseService.ts) with your own project values if you want to run it under your own backend.

Enable Firebase Authentication with the Anonymous sign-in provider. Pulse uses an anonymous Firebase session to protect each phone's private sync paths while still keeping onboarding simple.

Use [`firebase-database.rules.json`](./firebase-database.rules.json) as the Realtime Database rules template for the current device-code based sync flow.

Make sure your Realtime Database rules allow the app to read and write the paths it uses for:

- `users/{deviceId}/status`
- `users/{deviceId}/nudges`
- `users/{deviceId}/history`

## A Few Notes

- Pairing is based on a device-generated 6-character ID
- The current design is intentionally minimal and a little intimate
- Firebase presence and nudge handling were recently tightened up to improve realtime reliability

## Future Improvements

- Push notifications for nudges while the app is backgrounded
- Better pairing UX with invite links or QR codes
- Per-user SOS contact configuration
- Cleaner onboarding and setup validation

## Author

PragnyaPrakash
