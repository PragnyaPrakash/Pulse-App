import { initializeApp } from 'firebase/app';
import {
    getDatabase,
    ref,
    onValue,
    set,
    push,
    serverTimestamp,
    get,
    onDisconnect,
    onChildAdded,
    remove
} from 'firebase/database';
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

let isFirebaseInitialized = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.databaseURL
);
let presenceInitializedFor: string | null = null;

const STATUS_LABELS: Record<'online' | 'locked' | 'sos', string> = {
    online: 'Unlocked',
    locked: 'Locked',
    sos: 'SOS Triggered'
};

const normalizeTimestamp = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return null;
};

const ensurePresenceTracking = async (deviceId: string) => {
    if (!isFirebaseInitialized || presenceInitializedFor === deviceId) return;

    const connectedRef = ref(db, '.info/connected');
    const statusRef = ref(db, `users/${deviceId}/status`);

    onValue(connectedRef, async (snapshot) => {
        if (snapshot.val() !== true) return;

        await onDisconnect(statusRef).set({
            state: 'away',
            lastChanged: serverTimestamp(),
        });

        await set(statusRef, {
            state: 'online',
            lastChanged: serverTimestamp(),
        });
    });

    presenceInitializedFor = deviceId;
};


export const FirebaseService = {
    isConfigured() {
        return isFirebaseInitialized;
    },

    /**
     * Updates current user status in Firebase with Presence
     */
    async updateStatus(status: 'online' | 'locked' | 'sos' | 'away') {
        if (!isFirebaseInitialized) return;

        const deviceId = await StorageService.getDeviceId();
        const statusRef = ref(db, `users/${deviceId}/status`);

        if (status === 'online') {
            await ensurePresenceTracking(deviceId);
        }

        await set(statusRef, {
            state: status,
            lastChanged: serverTimestamp(),
        });

        if (status !== 'away') {
            const historyRef = ref(db, `users/${deviceId}/history`);
            await push(historyRef, {
                status: STATUS_LABELS[status as 'online' | 'locked' | 'sos'] || status.toUpperCase(),
                timestamp: serverTimestamp(),
            });
        }
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
            clientTimestamp: Date.now(),
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

        return onChildAdded(nudgeRef, async (snapshot) => {
            const nudge = snapshot.val();
            const timestamp =
                normalizeTimestamp(nudge?.timestamp) ??
                normalizeTimestamp(nudge?.clientTimestamp);

            if (!timestamp || timestamp < sessionStart - 5000) {
                return;
            }

            console.log("[Firebase] New nudge received!");
            onNudge();
            await remove(snapshot.ref);
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
            return Object.values(data)
                .filter(Boolean)
                .sort((a: any, b: any) => {
                    const aTime = normalizeTimestamp(a?.timestamp) ?? 0;
                    const bTime = normalizeTimestamp(b?.timestamp) ?? 0;
                    return bTime - aTime;
                });
        }
        return [];
    }
};
