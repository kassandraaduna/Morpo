import React from 'react';
import { View, StyleSheet } from 'react-native';
import AppController from './AppController';

const App = () => {
    return (
        
        <View style={styles.appRoot}>
            <AppController />
        </View>
    );
};

const styles = StyleSheet.create({
    appRoot: {
        flex: 1,
        backgroundColor: '#fff',
    },
});

export default App;