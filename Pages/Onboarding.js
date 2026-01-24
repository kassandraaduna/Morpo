import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Modal, ScrollView, CheckBox, } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const onboardingData = [
    {
        id: '1',
        title: 'Grow Your Knowledge',
        description: 'Learn new skills and expand your knowledge with our comprehensive learning platform.',
        color: '#6B9F7F',
    },
    {
        id: '2',
        title: 'Explore Interactive 3D Models',
        description: 'Dive into interactive 3D models to enhance your understanding of complex concepts in a fun and engaging way.',
        color: '#6B9F7F',
    },
    {
        id: '3',
        title: 'Assess Your Knowledge',
        description: 'Test your understanding with quizzes and assessments designed to reinforce your learning and track your progress.',
        color: '#6B9F7F',
    },
    ];

const Onboarding = ({ navigation }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { width, height } = useWindowDimensions();
    const scale = Math.min(width, height) / 400;

    const handleNext = () => {
        if (currentIndex < onboardingData.length - 1) {
        setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
        }
    };

    const handleGetStarted = async () => {
        try {
        await AsyncStorage.setItem('onboardingCompleted', 'true');
        navigation.replace('Login');
        } catch (error) {
        console.error('Error:', error);
        navigation.replace('Login');
        }
    };

    const item = onboardingData[currentIndex];

    return (
        <View style={[styles.container, { backgroundColor: item.color }]}>
        {/* Graphics Box */}
        <View style={[styles.graphicsBox, { marginTop: height * 0.08 }]}>
            <Text style={[styles.graphicsText, { fontSize: 12 * scale }]}>
            graphics{'\n'}connected to{'\n'}headline
            </Text>
        </View>

        {/* Content */}
        <View style={[styles.contentBox, { paddingHorizontal: width * 0.06 }]}>
            <Text style={[styles.title, { fontSize: 22 * scale, marginBottom: 12 * scale }]}>
            {item.title}
            </Text>
            <Text style={[styles.description, { fontSize: 13 * scale, lineHeight: 18 * scale }]}>
            {item.description}
            </Text>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomContainer}>
            {/* Prev Button */}
            {currentIndex > 0 && currentIndex < onboardingData.length - 1 && (
            <TouchableOpacity
                onPress={handlePrevious}
                style={[
                styles.arrowButton,
                {
                    width: 44 * scale,
                    height: 44 * scale,
                    borderRadius: 22 * scale,
                },
                ]}
            >
                <Text style={[styles.arrowText, { fontSize: 18 * scale }]}>←</Text>
            </TouchableOpacity>
            )}
            {currentIndex === 0 && currentIndex < onboardingData.length - 1 && (
            <View style={{ width: 44 * scale, height: 44 * scale }} />
            )}

            {/* Navigation Dots - Middle */}
            <View style={styles.dotsContainer}>
            {onboardingData.map((_, index) => (
                <View
                key={index}
                style={[
                    styles.dot,
                    { backgroundColor: index === currentIndex ? '#000' : '#fff' },
                ]}
                />
            ))}
            </View>

            {/* Next Button */}
            {currentIndex < onboardingData.length - 1 && (
            <TouchableOpacity
                onPress={handleNext}
                style={[
                styles.arrowButton,
                {
                    width: 44 * scale,
                    height: 44 * scale,
                    borderRadius: 22 * scale,
                },
                ]}
            >
                <Text style={[styles.arrowText, { fontSize: 18 * scale }]}>→</Text>
            </TouchableOpacity>
            )}
        </View>

        {/* GET STARTED Button (last screen) */}
        {currentIndex === onboardingData.length - 1 && (
            <TouchableOpacity
            onPress={handleGetStarted}
            style={[
                styles.getStartedButton,
                {
                paddingVertical: 10 * scale,
                paddingHorizontal: 30 * scale,
                marginBottom: height * 0.06,
                },
            ]}
            >
            <Text style={[styles.getStartedText, { fontSize: 13 * scale }]}>GET STARTED</Text>
            </TouchableOpacity>
        )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    graphicsBox: {
        width: '80%',
        aspectRatio: 1,
        borderWidth: 2,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
    },
    graphicsText: {
        color: '#fff',
        textAlign: 'center',
        lineHeight: 18,
    },
    arrowButtonsContainer: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    contentBox: {
        flex: 1,
        justifyContent: 'center',
        width: '100%',
    },
    title: {
        fontWeight: 'bold',
        color: '#fff',
    },
    description: {
        color: '#fff',
        opacity: 0.95,
    },
    bottomContainer: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: '6%',
        paddingBottom: '6%',
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 8,
        flex: 1,
        justifyContent: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    arrowButton: {
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
    },
    arrowText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    getStartedButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 25,
        marginBottom: '6%',
    },
    getStartedText: {
        color: '#000',
        fontWeight: '600',
        textAlign: 'center',
    },
});

export default Onboarding;
