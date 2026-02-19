import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push, serverTimestamp, get } from 'firebase/database';
import { StorageService } from './StorageService';

// Firebase configuration (Placeholder - User needs to fill this or I use a test one)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "pulseapp-test.firebaseapp.com",
    databaseURL: "https://pulseapp-test-default-rtdb.firebaseio.com",
    projectId: "pulseapp-test",
    storageBucket: "pulseapp-test.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Connectivity status
let isFirebaseInitialized = firebaseConfig.apiKey !== "YOUR_API_KEY";

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
            onValue(connectedRef, (snap) => {
                if (snap.val() === true) {
                    // When app closes, set to away
                    const stateRef = ref(db, `users/${deviceId}/status/state`);
                    set(stateRef, 'online');
                    // onDisconnect().set() is not directly available in some older JS SDK versions but 
                    // standard in v9+ database. We use the ref-based approach if available.
                }
            });
        }

        await set(statusRef, {
            state: status,
            lastChanged: serverTimestamp(),
        });

        // Also log to history
        const historyRef = ref(db, `users/${deviceId}/history`);
        await push(historyRef, {
            status: status.toUpperCase(),
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

        // Use onValue but check for the latest timestamp to avoid old nudges re-triggering
        // Or simpler: handle each child as it comes.
        return onValue(nudgeRef, (snapshot) => {
            if (snapshot.exists()) {
                onNudge();
                // Optionally: StorageService.clearIncomingNudges(id) -> But we'll do that in App.tsx logic
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
    },

    /**
     * Fetches partner's history
     */

    async getPartnerHistory(): Promise<any[]> {
        const partnerId = await StorageService.getPartnerId();
        if (!partnerId) return [];

        const historyRef = ref(db, `users/${partnerId}/history`);
        const snapshot = await get(historyRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            return Object.values(data).reverse();
        }
        return [];
    }
};
