import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, serverTimestamp, get } from 'firebase/database';
import { StorageService } from './StorageService';

// Firebase configuration (Placeholder - User needs to fill this or I use a test one)
const firebaseConfig = {
    apiKey: "AIzaSyD1Ff56sNbDq9YM50VQup9D9M5qdyeGe4U",
    authDomain: "web-app-77a30.firebaseapp.com",
    databaseURL: "https://web-app-77a30-default-rtdb.firebaseio.com",
    projectId: "web-app-77a30",
    storageBucket: "web-app-77a30.firebasestorage.app",
    messagingSenderId: "648289185701",
    appId: "1:648289185701:web:972e48af92fc095e86424c",
    measurementId: "G-FCG5K5M2D8"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Connectivity status
let isFirebaseInitialized = firebaseConfig.apiKey !== "AIzaSyD1Ff56sNbDq9YM50VQup9D9M5qdyeGe4U" || firebaseConfig.projectId !== "pulseapp-test";
// Note: Since you just pasted the keys, I am setting this to true.
isFirebaseInitialized = true;


export const FirebaseService = {
    isConfigured() {
        return isFirebaseInitialized;
    },

    /**
     * Updates current user status in Firebase with Presence
     */
    async updateStatus(status: 'online' | 'locked' | 'sos') {
        if (!isFirebaseInitialized) return;

        const deviceId = await StorageService.getDeviceId();
        const statusRef = ref(db, `users/${deviceId}/status`);

        // Presence: Set to offline when disconnected
        if (status === 'online') {
            const connectedRef = ref(db, '.info/connected');
            const { onDisconnect } = require('firebase/database'); // Import dynamically if needed or ensure it's in top-level

            onValue(connectedRef, (snap) => {
                if (snap.val() === true) {
                    // Set status to online when connected
                    const stateRef = ref(db, `users/${deviceId}/status/state`);
                    set(stateRef, 'online');

                    // Automatically set to 'away' on disconnect
                    const onDisconnectRef = onDisconnect(stateRef);
                    onDisconnectRef.set('away');
                }
            });
        }

        await set(statusRef, {
            state: status,
            lastChanged: serverTimestamp(),
        });

        // Also log to history with human readable labels
        const historyRef = ref(db, `users/${deviceId}/history`);
        const statusLabels = {
            online: 'Unlocked',
            locked: 'Locked',
            sos: 'SOS Triggered'
        };

        await push(historyRef, {
            status: statusLabels[status] || status.toUpperCase(),
            timestamp: serverTimestamp(),
        });
    },

    /**
     * Sends a nudge to the partner via a queue (push)
     */
    async sendNudge() {
        if (!isFirebaseInitialized) return;
        const partnerId = await StorageService.getPartnerId();
        const myId = await StorageService.getDeviceId();
        if (!partnerId) return;

        const nudgeRef = ref(db, `users/${partnerId}/nudges`);
        await push(nudgeRef, {
            from: myId,
            timestamp: serverTimestamp(),
        });
    },


    /**
     * Listens for partner updates
     */
    subscribeToPartner(partnerId: string, onUpdate: (data: any) => void) {
        if (!isFirebaseInitialized) return () => { };
        const statusRef = ref(db, `users/${partnerId}/status`);
        return onValue(statusRef, (snapshot) => {
            onUpdate(snapshot.val());
        });
    },

    /**
     * Listens for incoming nudges via child_added
     */
    async subscribeToNudges(onNudge: () => void) {
        if (!isFirebaseInitialized) return () => { };
        const id = await StorageService.getDeviceId();
        const nudgeRef = ref(db, `users/${id}/nudges`);
        const sessionStart = Date.now();

        console.log(`[Firebase] Listening for nudges at users/${id}/nudges`);

        return onValue(nudgeRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const latestKey = Object.keys(data).pop();
                const latestNudge = latestKey ? data[latestKey] : null;

                // Only trigger if the nudge is new (within the last 10 seconds or since session start)
                if (latestNudge && latestNudge.timestamp > sessionStart - 10000) {
                    console.log("[Firebase] New nudge received!");
                    onNudge();
                }
            }
        });
    },




    /**
     * Clears all nudges for the current device
     */
    async clearNudges() {
        if (!isFirebaseInitialized) return;
        const id = await StorageService.getDeviceId();
        const nudgeRef = ref(db, `users/${id}/nudges`);
        await set(nudgeRef, null);
        console.log(`[FirebaseService] Nudges cleared for device ${id}.`);
    },

    /**
     * Fetches partner's history
     */

    async getPartnerHistory(): Promise<any[]> {
        if (!isFirebaseInitialized) {
            console.warn("[FirebaseService] Not initialized, cannot fetch partner history.");
            return [];
        }
        const partnerId = await StorageService.getPartnerId();
        if (!partnerId) {
            console.warn("[FirebaseService] Partner ID not found, cannot fetch partner history.");
            return [];
        }

        console.log(`[FirebaseService] Fetching history for partner ${partnerId}.`);
        const historyRef = ref(db, `users/${partnerId}/history`);
        const snapshot = await get(historyRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log(`[FirebaseService] Partner ${partnerId} history fetched:`, data);
            return Object.values(data).reverse();
        }
        return [];
    }
};
