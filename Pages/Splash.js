import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './src/styles/Styles';

export default function Splash({ navigation }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
        Animated.sequence([
            Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 700,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
            }),
        ])
        ).start();

        const init = async () => {
            await new Promise(res => setTimeout(res, 1500));

            const onboardingCompleted =
                await AsyncStorage.getItem('onboardingCompleted');

            if (onboardingCompleted === 'true') {
                navigation.replace('Login');
            } else {
                navigation.replace('Onboarding');
            }
        };

        init();
    }, []);

    return (
        <View style={styles.screen}>
            <View style={styles.splashLogoContainer}>
                <Animated.Image
                    source={require('../assets/mypholens_logo.png')}
                    style={[
                        styles.splashLogo,
                        { transform: [{ scale: scaleAnim }] },
                    ]}
                />
            </View>
        </View>
    );
}