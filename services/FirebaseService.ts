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
    remove,
    update
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

export type DeviceStatus = 'online' | 'locked' | 'sos' | 'away';

let isFirebaseInitialized = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.databaseURL
);
let presenceInitializedFor: string | null = null;

const STATUS_LABELS: Record<Exclude<DeviceStatus, 'away'>, string> = {
    online: 'Unlocked',
    locked: 'Locked',
    sos: 'SOS Triggered'
};

const normalizeTimestamp = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return null;
};

const normalizeCode = (code: string) => code.trim().toUpperCase();

const firebaseErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'Firebase sync failed. Please check database rules and internet connection.';
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

    async registerDevice() {
        if (!isFirebaseInitialized) return;

        const deviceId = await StorageService.getDeviceId();
        const profileRef = ref(db, `users/${deviceId}/profile`);

        try {
            await update(profileRef, {
                id: deviceId,
                appName: 'Pulse',
                appVersion: '1.0.1',
                lastSeen: serverTimestamp(),
            });
        } catch (error) {
            throw new Error(firebaseErrorMessage(error));
        }
    },

    async validatePartnerCode(code: string) {
        if (!isFirebaseInitialized) {
            return { valid: false, message: 'Firebase is not configured.' };
        }

        const partnerId = normalizeCode(code);
        const myId = await StorageService.getDeviceId();

        if (partnerId.length !== 6) {
            return { valid: false, message: 'Please enter a 6-character Device ID.' };
        }

        if (partnerId === myId) {
            return { valid: false, message: 'This is your own ID. Enter your partner device ID.' };
        }

        try {
            const profileSnapshot = await get(ref(db, `users/${partnerId}/profile`));
            if (!profileSnapshot.exists()) {
                return { valid: false, message: 'No Pulse device found with this ID. Open Pulse once on your partner phone, then try again.' };
            }

            return { valid: true, partnerId };
        } catch (error) {
            return { valid: false, message: firebaseErrorMessage(error) };
        }
    },

    async pairWithPartner(code: string) {
        const result = await this.validatePartnerCode(code);
        if (!result.valid || !result.partnerId) {
            throw new Error(result.message);
        }

        const myId = await StorageService.getDeviceId();
        await StorageService.setPartnerId(result.partnerId);

        try {
            await set(ref(db, `users/${myId}/pairing`), {
                partnerId: result.partnerId,
                pairedAt: serverTimestamp(),
            });
        } catch (error) {
            await StorageService.clearPairing();
            throw new Error(firebaseErrorMessage(error));
        }

        return result.partnerId;
    },

    async clearPairing() {
        const myId = await StorageService.getDeviceId();
        await StorageService.clearPairing();

        if (!isFirebaseInitialized) return;

        try {
            await remove(ref(db, `users/${myId}/pairing`));
        } catch (error) {
            console.warn('[FirebaseService] Failed to clear remote pairing:', error);
        }
    },

    /**
     * Updates current user status in Firebase with Presence
     */
    async updateStatus(status: DeviceStatus) {
        if (!isFirebaseInitialized) return;

        const deviceId = await StorageService.getDeviceId();
        const statusRef = ref(db, `users/${deviceId}/status`);

        try {
            await this.registerDevice();

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
                    status: STATUS_LABELS[status],
                    timestamp: serverTimestamp(),
                });
            }
        } catch (error) {
            throw new Error(firebaseErrorMessage(error));
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

        const validation = await this.validatePartnerCode(partnerId);
        if (!validation.valid) {
            await StorageService.clearPairing();
            throw new Error(validation.message);
        }

        try {
            const nudgeRef = ref(db, `users/${partnerId}/nudges`);
            await push(nudgeRef, {
                from: myId,
                to: partnerId,
                timestamp: serverTimestamp(),
            });
        } catch (error) {
            throw new Error(firebaseErrorMessage(error));
        }
    },


    /**
     * Listens for partner updates
     */
    subscribeToPartner(partnerId: string, onUpdate: (data: any) => void) {
        if (!isFirebaseInitialized) return () => { };
        const statusRef = ref(db, `users/${partnerId}/status`);
        return onValue(statusRef, (snapshot) => {
            onUpdate(snapshot.val());
        }, (error) => {
            console.warn('[FirebaseService] Partner status listener failed:', error);
            onUpdate(null);
        });
    },

    /**
     * Listens for incoming nudges via child_added
     */
    async subscribeToNudges(onNudge: () => void) {
        if (!isFirebaseInitialized) return () => { };
        const id = await StorageService.getDeviceId();
        const partnerId = await StorageService.getPartnerId();
        if (!partnerId) return () => { };

        const nudgeRef = ref(db, `users/${id}/nudges`);

        console.log(`[Firebase] Listening for nudges at users/${id}/nudges`);

        return onChildAdded(nudgeRef, async (snapshot) => {
            const nudge = snapshot.val();

            if (nudge?.from !== partnerId) {
                await remove(snapshot.ref);
                return;
            }

            console.log("[Firebase] New nudge received!");
            onNudge();
            await remove(snapshot.ref);
        }, (error) => {
            console.warn('[FirebaseService] Nudge listener failed:', error);
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
        try {
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
        } catch (error) {
            throw new Error(firebaseErrorMessage(error));
        }
    }
};
