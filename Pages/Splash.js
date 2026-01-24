import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

const Splash = ({ navigation }) => {
    const { width, height } = useWindowDimensions();
    const scale = Math.min(width, height) / 400;

    useEffect(() => {
        const timer = setTimeout(() => {
        navigation.replace('Onboarding');
        }, 2000);

        return () => clearTimeout(timer);
    }, [navigation]);

    return (
        <View style={styles.container}>
        <View style={[styles.logoBox, { width: 100 * scale, height: 100 * scale }]}>
            <Text style={[styles.logoText, { fontSize: 14 * scale }]}>LOGO</Text>
        </View>
        <Text style={[styles.appName, { fontSize: 24 * scale, marginTop: 20 * scale }]}>MyphoLens</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoBox: {
        borderWidth: 2,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoText: {
        fontWeight: 'bold',
        color: '#000',
    },
    appName: {
        fontWeight: 'bold',
        color: '#000',
    },
});

export default Splash;
