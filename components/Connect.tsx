import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Share,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { StorageService } from '../services/StorageService';
import { FirebaseService } from '../services/FirebaseService';
import { Share2, Link2, Ghost, ChevronLeft, Heart } from 'lucide-react-native';

interface ConnectProps {
    onBack: () => void;
    theme: any;
    onPairingChanged?: () => void;
}

export const Connect = ({ onBack, theme, onPairingChanged }: ConnectProps) => {
    const [deviceId, setDeviceId] = useState('');
    const [partnerIdInput, setPartnerIdInput] = useState('');
    const [isPaired, setIsPaired] = useState(false);
    const [isPairing, setIsPairing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadData();
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    const loadData = async () => {
        try {
            const id = await StorageService.getDeviceId();
            setDeviceId(id);
            await FirebaseService.registerDevice();

            const partner = await StorageService.getPartnerId();
            if (partner) {
                const validation = await FirebaseService.validatePartnerCode(partner);
                if (!validation.valid) {
                    await StorageService.clearPairing();
                    setIsPaired(false);
                    setPartnerIdInput('');
                    Alert.alert('Pairing Reset', validation.message);
                    onPairingChanged?.();
                    return;
                }

                setIsPaired(true);
                setPartnerIdInput(partner);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not connect to Firebase.';
            Alert.alert('Sync Setup Failed', message);
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Stay in sync with me on Pulse! My ID: ${deviceId}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handlePair = async () => {
        const sanitizedId = partnerIdInput.trim().toUpperCase();

        setIsPairing(true);
        try {
            const partnerId = await FirebaseService.pairWithPartner(sanitizedId);

            setIsPaired(true);
            setPartnerIdInput(partnerId);
            onPairingChanged?.();
            Alert.alert('Synchronized!', 'Your Pulse is now connected.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not connect to this partner ID.';
            Alert.alert('Connection Failed', message);
        } finally {
            setIsPairing(false);
        }
    };


    const handleUnpair = async () => {
        Alert.alert(
            'Disconnect?',
            'Stop syncing with your partner?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        await FirebaseService.clearPairing();
                        setIsPaired(false);
                        setPartnerIdInput('');
                        onPairingChanged?.();
                    }
                },
            ]
        );
    };

    return (
        <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <ChevronLeft size={28} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
                </View>

                <View style={styles.content}>
                    <View style={[styles.card, { backgroundColor: theme.primary + '1A', borderColor: theme.accent + '22' }]}>
                        <View style={styles.cardHeader}>
                            <Heart size={18} color={theme.accent} />
                            <Text style={[styles.label, { color: theme.text }]}>My Pulse Identity</Text>
                        </View>
                        <View style={styles.idContainer}>
                            <Text style={[styles.idText, { color: theme.text }]} numberOfLines={1}>{deviceId}</Text>
                            <TouchableOpacity onPress={handleShare} style={styles.iconButton}>
                                <Share2 size={20} color={theme.accent} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.hint, { color: theme.text, opacity: 0.6 }]}>
                            Share this with your partner to bridge your hearts.
                        </Text>
                    </View>

                    {!isPaired ? (
                        <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                            <Text style={[styles.label, { color: theme.text, opacity: 0.6 }]}>Partner's ID</Text>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.accent + '33' }]}
                                placeholder="Enter ID here..."
                                placeholderTextColor="rgba(255,255,255,0.2)"
                                value={partnerIdInput}
                                onChangeText={(value) => setPartnerIdInput(value.toUpperCase())}
                                autoCapitalize="characters"
                                maxLength={6}
                            />
                            <TouchableOpacity
                                style={[styles.pairButton, { backgroundColor: theme.accent, opacity: isPairing ? 0.7 : 1 }]}
                                onPress={handlePair}
                                disabled={isPairing}
                            >
                                <Link2 size={20} color="#FFF" />
                                <Text style={styles.pairButtonText}>{isPairing ? 'Checking Partner...' : 'Connect Hearts'}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={[styles.card, { backgroundColor: 'rgba(253,216,230,0.1)', borderColor: theme.accent + '44' }]}>
                            <View style={styles.pairedHeader}>
                                <Ghost size={24} color={theme.accent} />
                                <Text style={[styles.pairedText, { color: theme.text }]}>Hearts are Synced</Text>
                            </View>
                            <Text style={[styles.partnerIdLabel, { color: theme.text, opacity: 0.5 }]}>Partner: {partnerIdInput}</Text>
                            <TouchableOpacity
                                style={styles.unpairButton}
                                onPress={handleUnpair}
                            >
                                <Text style={[styles.unpairButtonText, { color: theme.accent }]}>Disconnect Pulse</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.infoSection}>
                        <Text style={[styles.infoTitle, { color: theme.text }]}>About Pulse</Text>
                        <Text style={[styles.infoText, { color: theme.text, opacity: 0.5 }]}>
                            Version 1.0.2 • Subtle & Creative Connection
                        </Text>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backButton: {
        padding: 5,
        marginRight: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: '300',
    },
    content: {
        paddingHorizontal: 25,
    },
    card: {
        padding: 22,
        borderRadius: 24,
        marginBottom: 20,
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginLeft: 10,
    },
    idContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 14,
        borderRadius: 16,
    },
    idText: {
        fontSize: 14,
        flex: 1,
        marginRight: 10,
        fontWeight: '500',
    },
    iconButton: {
        padding: 4,
    },
    hint: {
        fontSize: 12,
        marginTop: 12,
        lineHeight: 18,
    },
    input: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        fontSize: 14,
        marginBottom: 15,
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    pairButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 18,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    pairButtonText: {
        marginLeft: 10,
        fontWeight: '700',
        color: '#FFF',
        fontSize: 16,
    },
    pairedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    pairedText: {
        marginLeft: 10,
        fontWeight: '700',
        fontSize: 18,
    },
    partnerIdLabel: {
        textAlign: 'center',
        fontSize: 12,
        marginBottom: 15,
    },
    unpairButton: {
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    unpairButtonText: {
        fontSize: 14,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    infoSection: {
        marginTop: 20,
        alignItems: 'center',
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 12,
    }
});
