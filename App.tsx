import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  AppState,
  Linking,
  Alert,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from './constants/Colors';
import { Pulsar } from './components/Pulsar';
import { Heart, Settings as SettingsIcon, Clock } from 'lucide-react-native';
import { StorageService } from './services/StorageService';
import { FirebaseService } from './services/FirebaseService';
import { Connect } from './components/Connect';
import { History } from './components/History';

type ViewState = 'pulse' | 'connect' | 'history';

export default function App() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  const [currentView, setCurrentView] = useState<ViewState>('pulse');
  const [isPartnerActive, setIsPartnerActive] = useState(false);
  const [lastNudgeDate, setLastNudgeDate] = useState<Date | null>(null);
  const [isPaired, setIsPaired] = useState(false);

  const appState = useRef(AppState.currentState);
  const sosCounter = useRef(0);
  const lastClickTime = useRef(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeApp();

    // Check pairing status every 5 seconds to update UI
    const interval = setInterval(checkPairing, 5000);
    return () => clearInterval(interval);
  }, []);

  const initializeApp = async () => {
    await checkPairing();
    setupAppStateListener();
    FirebaseService.updateStatus('online');
  };


  const checkPairing = async () => {
    const partner = await StorageService.getPartnerId();
    setIsPaired(!!partner);
  };

  const setupAppStateListener = () => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        FirebaseService.updateStatus('online');
      } else if (nextAppState.match(/inactive|background/)) {
        FirebaseService.updateStatus('locked');
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  };

  useEffect(() => {
    let statusUnsub: (() => void) | null = null;
    let nudgeUnsub: (() => void) | null = null;

    const setupListeners = async () => {
      const partnerId = await StorageService.getPartnerId();
      if (partnerId) {
        statusUnsub = FirebaseService.subscribeToPartner(partnerId, (data) => {
          if (data && data.state) {
            setIsPartnerActive(data.state === 'online');
          } else {
            setIsPartnerActive(false);
          }
        });
      }

      nudgeUnsub = await FirebaseService.subscribeToNudges(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLastNudgeDate(new Date());
        // Clear queue after handling
        FirebaseService.clearNudges();
      });
    };

    if (isPaired && FirebaseService.isConfigured()) {
      setupListeners();
    } else {
      setIsPartnerActive(false);
    }


    return () => {
      if (statusUnsub) statusUnsub();
      if (nudgeUnsub) nudgeUnsub();
    };
  }, [isPaired]);


  const handleNudge = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLastNudgeDate(new Date());
    await FirebaseService.sendNudge();
  };

  const handleSOS = async () => {
    const now = Date.now();
    if (now - lastClickTime.current < 800) {
      sosCounter.current += 1;
    } else {
      sosCounter.current = 1;
    }
    lastClickTime.current = now;

    if (sosCounter.current >= 3) {
      sosCounter.current = 0;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      const sosNumber = '9704492430';

      Alert.alert(
        'EMERGENCY SOS',
        `Calling ${sosNumber}...`,
        [{ text: 'Cancel', style: 'cancel' }],
        { cancelable: true }
      );

      FirebaseService.updateStatus('sos');
      Linking.openURL(`tel:${sosNumber}`);
    }
  };

  const switchView = (view: ViewState) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentView(view);
      checkPairing();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  if (currentView === 'connect') {
    return <Connect onBack={() => switchView('pulse')} theme={theme} />;
  }

  if (currentView === 'history') {
    return <History onBack={() => switchView('pulse')} theme={theme} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => switchView('history')} style={styles.navButton}>
            <Clock size={24} color={theme.text} opacity={0.6} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => switchView('connect')} style={styles.navButton}>
            <SettingsIcon size={24} color={theme.text} opacity={0.6} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>Pulse</Text>

            <View style={[styles.syncIndicator, { backgroundColor: FirebaseService.isConfigured() ? '#4CAF50' : '#FF9800' }]} />
          </View>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.5 }]}>
            {!FirebaseService.isConfigured()
              ? 'Action Required: Setup Firebase Keys'
              : isPaired ? 'Bridged with Partner' : 'Seek a Heart to Sync'}
          </Text>
        </View>


        <View style={styles.pulseContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSOS}
          >
            <Pulsar active={isPartnerActive} color={theme.accent} />
          </TouchableOpacity>
          <View style={styles.statusBox}>
            <Text style={[styles.statusText, { color: theme.text }]}>
              {isPartnerActive ? 'Partner is Active' : 'Partner is Away'}
            </Text>
            <View style={[styles.dot, { backgroundColor: isPartnerActive ? '#4CAF50' : '#888' }]} />
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleNudge}
            activeOpacity={0.7}
          >
            <Heart size={20} color={theme.accent} fill={theme.accent + '33'} />
            <Text style={[styles.buttonText, { color: theme.text }]}>Send Nudge</Text>
          </TouchableOpacity>

          {lastNudgeDate && (
            <Text style={[styles.lastNudgeText, { color: theme.text, opacity: 0.4 }]}>
              Last Pulse: {lastNudgeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}

          <Text style={[styles.sosHint, { color: theme.text, opacity: 0.2 }]}>
            Privacy Preserved • Connection Secured
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'space-between',
    paddingVertical: 50,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    padding: 10,
    marginHorizontal: -10,
  },
  header: {
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '200',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  syncIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
    marginTop: -8,
  },

  subtitle: {
    fontSize: 13,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  statusText: {
    fontSize: 14,
    marginRight: 10,
    fontWeight: '400',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footer: {
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 18,
    borderRadius: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  buttonText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  lastNudgeText: {
    marginTop: 18,
    fontSize: 12,
  },
  sosHint: {
    marginTop: 25,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});
