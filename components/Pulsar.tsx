import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { PulseHeart } from './PulseHeart';

interface PulsarProps {
    active: boolean;
    color: string;
}

export const Pulsar: React.FC<PulsarProps> = ({ active, color }) => {
    const pulse = useSharedValue(1);
    const opacity = useSharedValue(0.4);

    useEffect(() => {
        if (active) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 800, easing: Easing.out(Easing.ease) }),
                    withTiming(1, { duration: 800, easing: Easing.in(Easing.ease) })
                ),
                -1,
                true
            );
            opacity.value = withRepeat(
                withTiming(0.8, { duration: 800 }),
                -1,
                true
            );
        } else {
            pulse.value = withTiming(1, { duration: 1000 });
            opacity.value = withTiming(0.2, { duration: 1000 });
        }
    }, [active]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: pulse.value }],
            opacity: opacity.value,
        };
    });

    const ringStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: pulse.value * 1.5 }],
            opacity: interpolate(pulse.value, [1, 1.2], [0.3, 0], Extrapolate.CLAMP),
        };
    });

    return (
        <View style={styles.container}>
            {active && (
                <Animated.View style={[styles.ring, { borderColor: color }, ringStyle]} />
            )}
            <Animated.View style={animatedStyle}>
                <PulseHeart size={160} color={color} fillOpacity={active ? 0.3 : 0.1} strokeWidth={active ? 2 : 1.5} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 2,
    },
});
