import React, { useEffect, useRef, useContext } from 'react';
import { View, Animated, Easing, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './src/styles/Styles';
import { ThemeContext } from './src/context/ThemeContext';

export default function Splash({ navigation }) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const { theme, darkMode, toggleTheme } = useContext(ThemeContext);

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
                navigation.replace('Login');
        };

        init();
    }, []);

    return (
        <View style={[styles.screen, {backgroundColor: theme.bg}]}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" />
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