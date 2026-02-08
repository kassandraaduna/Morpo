import React, { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import AppController from './AppController';
import Toast from 'react-native-toast-message';
import { ThemeProvider, ThemeContext } from './Pages/src/context/ThemeContext';

const AppContent = () => {
    const { theme } = useContext(ThemeContext);

    return (
        <View style={[styles.appRoot, { backgroundColor: theme.bg }]}>
        <AppController />
        <Toast />
        </View>
    );
    };

    const App = () => {
    return (
        <ThemeProvider>
        <AppContent />
        </ThemeProvider>
    );
    };

    const styles = StyleSheet.create({
    appRoot: {
        flex: 1,
    },
});

export default App;
