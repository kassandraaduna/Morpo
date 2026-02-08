import React, { useContext } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Swiper from 'react-native-swiper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from './src/styles/Styles';
import { ThemeContext } from './src/context/ThemeContext';

export default function Onboarding({ navigation }) {
    const { theme, darkMode, toggleTheme } = useContext(ThemeContext);

    return (
        <View style={[styles.screen, {backgroundColor: theme.bg}]}>
        <View style={styles.shell}>

            <Swiper
                loop={false}
                dotStyle={styles.dot}
                activeDotStyle={styles.activeDot}
                >

                {/* SLIDE 1 */}
                <View style={styles.slide}>
                    <Image source={require('../assets/favicon.png')} style={styles.image} />
                    <View style={styles.onboardingCard}>
                    <Text style={[styles.onboardingTitle, { color: theme.text }]}>EXPLORE MICROBIAL WORLD IN 3D.</Text>
                    <Text style={[styles.text, { color: theme.subText }]}>
                        Dive in the unseen world with high resolution microscopic imaging.
                    </Text>
                    </View>
                    <Text style={[styles.skip, { color: theme.text }]}>skip</Text>
                </View>

                {/* SLIDE 2 */}
                <View style={styles.slide}>
                    <Image source={require('../assets/favicon.png')} style={styles.image} />
                    <View style={styles.onboardingCard}>
                    <Text style={[styles.onboardingTitle, { color: theme.text }]}>INTERACT & LEARN IN 3D</Text>
                    <Text style={[styles.text, { color: theme.subText }]}>
                        Manipulate detailed 3D models and visualize structures.
                    </Text>
                    </View>
                    <Text style={[styles.skip, { color: theme.text }]}>skip</Text>
                </View>

                {/* SLIDE 3 */}
                <View style={styles.slide}>
                    <Image source={require('../assets/favicon.png')} style={styles.image} />
                    <View style={styles.onboardingCard}>
                    <Text style={[styles.onboardingTitle, { color: theme.text }]}>CHALLENGE YOUR KNOWLEDGE</Text>
                    <Text style={[styles.text, { color: theme.subText }]}>
                        Test expertise with engaging quizzes and track progress.
                    </Text>
                    </View>

                    <TouchableOpacity
                    style={styles.btn}
                    onPress={async () => {
                        await AsyncStorage.setItem('onboardingCompleted', 'true');
                        navigation.replace('Login');
                    }}                  
                    >
                    <Text style={[styles.btnText, { color: theme.text }]}>GET STARTED</Text>
                    </TouchableOpacity>
                </View>
            </Swiper>
        </View>
        </View>
    );
}
