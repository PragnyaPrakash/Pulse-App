import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';

const STORAGE_KEYS = {
    DEVICE_ID: 'pulse_device_id',
    PARTNER_ID: 'pulse_partner_id',
    SOS_NUMBER: 'pulse_sos_number',
    STATUS_HISTORY: 'pulse_status_history',
};

export const StorageService = {
    async getDeviceId(): Promise<string> {
        let id = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
        if (!id) {
            // Generate a 6-character unique ID (Uppercase Alphanumeric)
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            id = '';
            for (let i = 0; i < 6; i++) {
                id += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
        }
        return id;
    },

    async getPartnerId(): Promise<string | null> {
        return await AsyncStorage.getItem(STORAGE_KEYS.PARTNER_ID);
    },

    async setPartnerId(id: string): Promise<void> {
        const sanitizedId = (id || '').trim().toUpperCase();
        await AsyncStorage.setItem(STORAGE_KEYS.PARTNER_ID, sanitizedId);
    },


    async getSosNumber(): Promise<string | null> {
        return await AsyncStorage.getItem(STORAGE_KEYS.SOS_NUMBER);
    },

    async setSosNumber(num: string): Promise<void> {
        await AsyncStorage.setItem(STORAGE_KEYS.SOS_NUMBER, num);
    },

    async getStatusHistory(): Promise<any[]> {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.STATUS_HISTORY);
        return data ? JSON.parse(data) : [];
    },

    async addStatusToHistory(status: string): Promise<void> {
        const history = await this.getStatusHistory();
        const newEntry = {
            status,
            timestamp: new Date().toISOString(),
        };
        const updatedHistory = [newEntry, ...history].slice(0, 50); // Keep last 50
        await AsyncStorage.setItem(STORAGE_KEYS.STATUS_HISTORY, JSON.stringify(updatedHistory));
    },

    async clearPairing(): Promise<void> {
        await AsyncStorage.removeItem(STORAGE_KEYS.PARTNER_ID);
    }
};
