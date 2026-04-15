import AsyncStorage from '@react-native-async-storage/async-storage';
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
    update,
    limitToLast,
    query
} from 'firebase/database';
import * as FirebaseAuth from '@firebase/auth';
import { StorageService } from './StorageService';

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

let auth: FirebaseAuth.Auth;
try {
    auth = FirebaseAuth.initializeAuth(app, {
        persistence: (FirebaseAuth as any).getReactNativePersistence(AsyncStorage),
    });
} catch {
    auth = FirebaseAuth.getAuth(app);
}

export type DeviceStatus = 'online' | 'locked' | 'sos' | 'away';

export type PulseEvent = {
    id?: string;
    status: string;
    state: DeviceStatus | 'nudge';
    timestamp: number;
};

type PartnerValidation =
    | { valid: true; partnerId: string; partnerUid: string }
    | { valid: false; message: string };

let presenceInitializedFor: string | null = null;
let cachedUid: string | null = null;

const STATUS_LABELS: Record<Exclude<DeviceStatus, 'away'>, string> = {
    online: 'Unlocked',
    locked: 'Locked',
    sos: 'SOS Triggered'
};

const isFirebaseConfigured = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.databaseURL
);

const now = () => Date.now();

const normalizeCode = (code: string) => code.trim().toUpperCase();

const normalizeTimestamp = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return now();
};

const cleanFirebaseError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('auth/operation-not-allowed')) {
        return 'Firebase Anonymous sign-in is disabled. Enable Authentication > Sign-in method > Anonymous.';
    }

    if (message.includes('permission_denied') || message.includes('PERMISSION_DENIED')) {
        return 'Firebase denied sync. Publish the Realtime Database rules from firebase-database.rules.json.';
    }

    if (message.includes('timeout')) {
        return 'Firebase is taking too long to respond. Check internet and Firebase setup.';
    }

    return message || 'Firebase sync failed.';
};

const withTimeout = async <T,>(promise: Promise<T>, label: string, ms = 10000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

const ensureSession = async () => {
    if (!isFirebaseConfigured) {
        throw new Error('Firebase is not configured.');
    }

    if (cachedUid) return cachedUid;

    await withTimeout(auth.authStateReady(), 'auth ready');

    if (!auth.currentUser) {
        await withTimeout(FirebaseAuth.signInAnonymously(auth), 'anonymous sign-in');
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
        throw new Error('Could not create Firebase session.');
    }

    cachedUid = uid;
    return uid;
};

const getCodeOwner = async (code: string): Promise<string | null> => {
    const snapshot = await withTimeout(get(ref(db, `codes/${code}`)), 'partner lookup');
    const value = snapshot.val();
    return typeof value?.uid === 'string' ? value.uid : null;
};

const ensureUniqueDeviceCode = async (uid: string) => {
    let code = normalizeCode(await StorageService.getDeviceId());

    for (let attempt = 0; attempt < 6; attempt += 1) {
        const ownerUid = await getCodeOwner(code);
        if (!ownerUid || ownerUid === uid) {
            return code;
        }

        code = await StorageService.resetDeviceId();
    }

    throw new Error('Could not create a unique device code. Please try again.');
};

const writeHistory = async (uid: string, status: string, state: PulseEvent['state']) => {
    await withTimeout(Promise.resolve(push(ref(db, `history/${uid}`), {
        status,
        state,
        timestamp: serverTimestamp(),
        clientTimestamp: now(),
    })), 'history write');
};

const ensurePresenceTracking = async (uid: string, code: string) => {
    if (presenceInitializedFor === uid) return;

    const connectedRef = ref(db, '.info/connected');
    const statusRef = ref(db, `status/${uid}`);

    onValue(connectedRef, async (snapshot) => {
        if (snapshot.val() !== true) return;

        await onDisconnect(statusRef).set({
            code,
            state: 'away',
            lastChanged: serverTimestamp(),
            clientTimestamp: now(),
        });

        await set(statusRef, {
            code,
            state: 'online',
            lastChanged: serverTimestamp(),
            clientTimestamp: now(),
        });
    });

    presenceInitializedFor = uid;
};

export const FirebaseService = {
    isConfigured() {
        return isFirebaseConfigured;
    },

    async initialize() {
        await this.registerDevice();
        const partnerId = await StorageService.getPartnerId();
        const partnerUid = await StorageService.getPartnerUid();

        if (partnerId && partnerUid) {
            const validation = await this.validatePartnerCode(partnerId);
            if (!validation.valid) {
                await StorageService.clearPairing();
                throw new Error(validation.message);
            }
        }
    },

    async registerDevice() {
        const uid = await ensureSession();
        const code = await ensureUniqueDeviceCode(uid);

        await withTimeout(update(ref(db), {
            [`codes/${code}`]: {
                uid,
                code,
                updatedAt: serverTimestamp(),
            },
            [`users/${uid}/profile`]: {
                uid,
                code,
                appName: 'Pulse',
                appVersion: '1.0.2',
                lastSeen: serverTimestamp(),
            },
        }), 'device registration');

        return { uid, code };
    },

    async validatePartnerCode(code: string): Promise<PartnerValidation> {
        try {
            const partnerId = normalizeCode(code);
            const { uid } = await this.registerDevice();
            const myCode = normalizeCode(await StorageService.getDeviceId());

            if (partnerId.length !== 6) {
                return { valid: false, message: 'Please enter the exact 6-character partner ID.' };
            }

            if (partnerId === myCode) {
                return { valid: false, message: 'That is your own Pulse ID. Enter your partner ID.' };
            }

            const partnerUid = await getCodeOwner(partnerId);
            if (!partnerUid) {
                return { valid: false, message: 'No active Pulse device found with this ID. Open Pulse on the partner phone first.' };
            }

            if (partnerUid === uid) {
                return { valid: false, message: 'That ID belongs to this phone.' };
            }

            return { valid: true, partnerId, partnerUid };
        } catch (error) {
            return { valid: false, message: cleanFirebaseError(error) };
        }
    },

    async pairWithPartner(code: string) {
        const validation = await this.validatePartnerCode(code);
        if (!validation.valid) {
            throw new Error(validation.message);
        }

        const uid = await ensureSession();
        await StorageService.setPartnerId(validation.partnerId);
        await StorageService.setPartnerUid(validation.partnerUid);

        await withTimeout(set(ref(db, `pairings/${uid}`), {
            partnerCode: validation.partnerId,
            partnerUid: validation.partnerUid,
            pairedAt: serverTimestamp(),
        }), 'pairing write');

        return validation.partnerId;
    },

    async clearPairing() {
        const uid = await ensureSession();
        await StorageService.clearPairing();
        await withTimeout(remove(ref(db, `pairings/${uid}`)), 'pairing clear', 6000).catch(() => undefined);
    },

    async updateStatus(status: DeviceStatus) {
        const { uid, code } = await this.registerDevice();

        await withTimeout(set(ref(db, `status/${uid}`), {
            code,
            state: status,
            lastChanged: serverTimestamp(),
            clientTimestamp: now(),
        }), 'status update');

        if (status === 'online') {
            await ensurePresenceTracking(uid, code);
        }

        if (status !== 'away') {
            await writeHistory(uid, STATUS_LABELS[status], status);
        }
    },

    async sendNudge() {
        const partnerId = await StorageService.getPartnerId();
        const partnerUid = await StorageService.getPartnerUid();
        const { uid, code } = await this.registerDevice();

        if (!partnerId || !partnerUid) {
            throw new Error('Pair with your partner before sending a nudge.');
        }

        const validation = await this.validatePartnerCode(partnerId);
        if (!validation.valid || validation.partnerUid !== partnerUid) {
            await StorageService.clearPairing();
            throw new Error(validation.valid ? 'Partner pairing changed. Pair again.' : validation.message);
        }

        await withTimeout(Promise.resolve(push(ref(db, `nudges/${partnerUid}`), {
            fromUid: uid,
            fromCode: code,
            toUid: partnerUid,
            timestamp: serverTimestamp(),
            clientTimestamp: now(),
        })), 'nudge send');

        await writeHistory(uid, 'Nudge Sent', 'nudge');
    },

    async subscribeToPartner(onUpdate: (data: { state: DeviceStatus } | null) => void) {
        const partnerUid = await StorageService.getPartnerUid();
        if (!partnerUid) return () => { };

        return onValue(ref(db, `status/${partnerUid}`), (snapshot) => {
            const value = snapshot.val();
            onUpdate(value?.state ? value : null);
        }, (error) => {
            console.warn('[FirebaseService] Partner status listener failed:', error);
            onUpdate(null);
        });
    },

    async subscribeToNudges(onNudge: () => void) {
        const uid = await ensureSession();
        const partnerUid = await StorageService.getPartnerUid();
        if (!partnerUid) return () => { };

        return onChildAdded(ref(db, `nudges/${uid}`), async (snapshot) => {
            const nudge = snapshot.val();

            if (nudge?.fromUid !== partnerUid) {
                await remove(snapshot.ref);
                return;
            }

            onNudge();
            await writeHistory(uid, 'Nudge Received', 'nudge');
            await remove(snapshot.ref);
        }, (error) => {
            console.warn('[FirebaseService] Nudge listener failed:', error);
        });
    },

    async getPartnerHistory(): Promise<PulseEvent[]> {
        const partnerUid = await StorageService.getPartnerUid();
        if (!partnerUid) return [];

        const historyQuery = query(ref(db, `history/${partnerUid}`), limitToLast(30));
        const snapshot = await withTimeout(get(historyQuery), 'history load');

        if (!snapshot.exists()) return [];

        return Object.entries(snapshot.val() as Record<string, any>)
            .map(([id, item]) => ({
                id,
                status: String(item?.status ?? 'Activity'),
                state: (item?.state ?? 'away') as PulseEvent['state'],
                timestamp: normalizeTimestamp(item?.clientTimestamp ?? item?.timestamp),
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
    }
};
