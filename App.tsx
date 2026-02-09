import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useColorScheme,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from './constants/Colors';
import { Pulsar } from './components/Pulsar';
import { Heart } from 'lucide-react-native';

export default function App() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const [isPartnerActive, setIsPartnerActive] = useState(true);
  const [lastNudge, setLastNudge] = useState<Date | null>(null);

  const handleNudge = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLastNudge(new Date());
    // In a real app, this would send a ping to the backend
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Pulse</Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.6 }]}>
            Stay connected
          </Text>
        </View>

        <View style={styles.pulseContainer}>
          <Pulsar active={isPartnerActive} color={theme.accent} />
          <View style={styles.statusBox}>
            <Text style={[styles.statusText, { color: theme.text }]}>
              {isPartnerActive ? 'Parter is active now' : 'Partner was away'}
            </Text>
            <View style={[styles.dot, { backgroundColor: isPartnerActive ? '#4CAF50' : '#FFA000' }]} />
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleNudge}
            activeOpacity={0.7}
          >
            <Heart size={20} color={theme.text} />
            <Text style={[styles.buttonText, { color: theme.text }]}>Send a Nudge</Text>
          </TouchableOpacity>

          {lastNudge && (
            <Text style={[styles.lastNudgeText, { color: theme.text, opacity: 0.5 }]}>
              Last nudge sent at {lastNudge.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setIsPartnerActive(!isPartnerActive)}
          style={styles.toggle}
        >
          <Text style={{ color: theme.text, opacity: 0.3, fontSize: 10 }}>[Dev Toggle Status]</Text>
        </TouchableOpacity>
      </View>
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
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 5,
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    marginRight: 8,
    fontWeight: '400',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footer: {
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  buttonText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  lastNudgeText: {
    marginTop: 15,
    fontSize: 12,
  },
  toggle: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  }
});
