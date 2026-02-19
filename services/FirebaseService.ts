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

export const FirebaseService = {
    /**
     * Updates current user status in Firebase
     */
    async updateStatus(status: 'online' | 'locked' | 'sos') {
        const deviceId = await StorageService.getDeviceId();
        const statusRef = ref(db, `users/${deviceId}/status`);
        await set(statusRef, {
            state: status,
            lastChanged: serverTimestamp(),
        });

        // Also log to history for the partner
        const historyRef = ref(db, `users/${deviceId}/history`);
        await push(historyRef, {
            status: status.toUpperCase(),
            timestamp: serverTimestamp(),
        });
    },

    /**
     * Sends a nudge to the partner
     */
    async sendNudge() {
        const partnerId = await StorageService.getPartnerId();
        if (!partnerId) return;

        const nudgeRef = ref(db, `users/${partnerId}/nudges`);
        await set(nudgeRef, {
            from: await StorageService.getDeviceId(),
            timestamp: serverTimestamp(),
        });
    },

    /**
     * Listens for partner updates
     */
    subscribeToPartner(partnerId: string, onUpdate: (data: any) => void) {
        const statusRef = ref(db, `users/${partnerId}/status`);
        return onValue(statusRef, (snapshot) => {
            onUpdate(snapshot.val());
        });
    },

    /**
     * Listens for incoming nudges
     */
    async subscribeToNudges(onNudge: () => void) {
        const id = await StorageService.getDeviceId();
        const nudgeRef = ref(db, `users/${id}/nudges`);
        return onValue(nudgeRef, (snapshot) => {
            if (snapshot.exists()) {
                onNudge();
            }
        });
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
