import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert} from 'react-native';

function HomePage({ navigation }) {
    const [search, setSearch] = useState('');

    const handleSearch = () => {
        Alert.alert('Searching', `Searching for: ${search}`);
    };

    const handleLogout = () => {
        navigation.navigate('Login'); 
    };

    return (
        <View style={styles.homeBody}>
            <View style={styles.homeHeader}>
                <View style={styles.logo}>
                    <Text style={styles.logoText}>MyCro</Text>
                </View>

                <View style={styles.searchForm}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search..."
                        placeholderTextColor="#888"
                        value={search}
                        onChangeText={(text) => setSearch(text)}
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                        <Text>🔍</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.navButtons}>
                    <TouchableOpacity style={styles.navBtn}><Text style={styles.navBtnText}>Home</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.navBtn}><Text style={styles.navBtnText}>Lessons</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.navBtn}><Text style={styles.navBtnText}>Progress</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.navBtn}><Text style={styles.navBtnText}>Profile</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.navBtn, styles.logoutBtn]} onPress={handleLogout}>
                        <Text style={styles.logoutBtnText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.homeMain}>
                <Text style={styles.title}>Welcome mga cute!</Text>
                <Text style={styles.subtitle}>blahblahblahblahblah</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    homeBody: {
        flex: 1,
        backgroundColor: '#fff',
    },
    homeHeader: {
        padding: 20,
        backgroundColor: '#f8f8f8',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    logoText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    searchForm: {
        flexDirection: 'row',
        marginBottom: 15,
    },
    searchInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        paddingHorizontal: 10,
        height: 40,
    },
    searchBtn: {
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
        marginLeft: 5,
        borderRadius: 5,
    },
    navButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
    },
    navBtn: {
        backgroundColor: '#007AFF',
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 5,
        marginRight: 5,
    },
    navBtnText: {
        color: 'white',
        fontSize: 12,
    },
    logoutBtn: {
        backgroundColor: 'red',
    },
    logoutBtnText: {
        color: 'white',
        fontWeight: 'bold',
    },
    homeMain: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginTop: 10,
    },
});

export default HomePage;