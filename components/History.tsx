import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Animated,
} from 'react-native';
import { FirebaseService } from '../services/FirebaseService';
import { Clock, Unlock, Lock, PhoneCall, ChevronLeft } from 'lucide-react-native';

interface HistoryProps {
    onBack: () => void;
    theme: any;
}

export const History = ({ onBack, theme }: HistoryProps) => {
    const [history, setHistory] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadHistory();
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);

    const loadHistory = async () => {
        const data = await FirebaseService.getPartnerHistory();
        setHistory(data);
    };

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    }, []);

    const renderItem = ({ item }: { item: any }) => {
        const status = item.status || '';
        const isSOS = status.includes('SOS');
        const isUnlock = status === 'Unlocked' || status === 'ONLINE' || status === 'UNLOCKED';
        const isLocked = status === 'Locked' || status === 'LOCKED';

        return (
            <View style={[styles.item, { borderLeftColor: isSOS ? '#FF4444' : isUnlock ? '#4CAF50' : '#FF9800' }]}>
                <View style={styles.itemHeader}>
                    {isSOS ? (
                        <PhoneCall size={16} color="#FF4444" />
                    ) : isUnlock ? (
                        <Unlock size={16} color="#4CAF50" />
                    ) : (
                        <Lock size={16} color="#FF9800" />
                    )}
                    <Text style={[styles.itemStatus, { color: theme.text }]}>Partner {status}</Text>
                </View>
                <Text style={[styles.itemTime, { color: theme.text, opacity: 0.4 }]}>
                    {new Date(item.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </Text>
            </View>
        );
    };

    return (
        <Animated.View style={[styles.container, { backgroundColor: theme.background, opacity: fadeAnim }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButtonWrap}>
                    <ChevronLeft size={28} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.titleWrap}>
                    <Clock size={24} color={theme.accent} />
                    <Text style={[styles.title, { color: theme.text }]}>Partner Timeline</Text>
                </View>
            </View>

            <FlatList
                data={history}
                renderItem={renderItem}
                keyExtractor={(item, index) => index.toString()}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={[styles.emptyText, { color: theme.text, opacity: 0.3 }]}>
                            Waiting for partner activity...
                        </Text>
                    </View>
                }
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    backButtonWrap: {
        padding: 5,
        marginRight: 10,
    },
    titleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '300',
        marginLeft: 12,
    },
    list: {
        paddingBottom: 40,
    },
    item: {
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderLeftWidth: 4,
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginBottom: 12,
        borderRadius: 12,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemStatus: {
        fontSize: 16,
        fontWeight: '500',
        marginLeft: 10,
        textTransform: 'capitalize',
    },
    itemTime: {
        fontSize: 12,
    },
    empty: {
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
    }
});
