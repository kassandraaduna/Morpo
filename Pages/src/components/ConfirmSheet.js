import React, { useContext, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, Animated, Dimensions, Pressable,} from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import styles from '../styles/Styles';
import { ThemeContext } from '../context/ThemeContext';

const { height } = Dimensions.get('window');

export default function ConfirmSheet({
    visible,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    danger = false,
    }) {
    const { theme, darkMode } = useContext(ThemeContext);

    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        Animated.timing(slideAnim, {
        toValue: visible ? 0 : height,
        duration: visible ? 260 : 200,
        useNativeDriver: true,
        }).start();
    }, [visible]);

    return (
        <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={onCancel}
        >
        <View style={{ flex: 1 }}>
            <Pressable
            style={{ flex: 1 }}
            onPress={onCancel}
            >
            <BlurView
                intensity={darkMode ? 100 : 100}
                tint={darkMode ? 'dark' : 'light'}
                style={{ flex: 1 }}
            />
            </Pressable>

            <Animated.View
                style={[
                    styles.confirmSheet,
                    {
                    backgroundColor: theme.search,
                    transform: [{ translateY: slideAnim }],
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -6 },
                    shadowOpacity: 1,
                    shadowRadius: 25,
                    elevation: 10,
                    },
                ]}
            >
            <Text
                style={[
                styles.confirmTitle,
                { color: theme.text },
                ]}
            >
                {title}
            </Text>

            <Text
                style={[
                styles.confirmMessage,
                { color: theme.subText },
                ]}
            >
                {message}
            </Text>

            <View style={styles.confirmActions}>
                <TouchableOpacity
                style={styles.confirmCancel}
                onPress={onCancel}
                >
                <Text
                    style={[
                    styles.confirmCancelText,
                    { color: theme.subText },
                    ]}
                >
                    {cancelText}
                </Text>
                </TouchableOpacity>

                <TouchableOpacity
                style={[
                    styles.confirmConfirm,
                    danger && styles.confirmDanger,
                ]}
                onPress={onConfirm}
                >
                <Text
                    style={[
                    styles.confirmConfirmText,
                    { color: danger ? '#FFF' : theme.text },
                    ]}
                >
                    {confirmText}
                </Text>
                </TouchableOpacity>
            </View>
            </Animated.View>
        </View>
        </Modal>
    );
}
