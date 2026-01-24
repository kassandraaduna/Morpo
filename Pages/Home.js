import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function Homepage() {
    return (
        <ScrollView contentContainerStyle={styles.scroll}>

        {/* HEADER */}
        <View style={styles.header}>
            <View>
            <Text style={styles.hello}>HELLO,</Text>
            <Text style={styles.name}>STUDENT</Text>
            </View>
            <View style={styles.profilePic}>
            <Text style={styles.picText}>PIC</Text>
            </View>
        </View>

        {/* SEARCH */}
        <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} />
            <TextInput placeholder="Search" style={styles.searchInput} />
        </View>

        {/* ICON GRID */}
        <View style={styles.iconGrid}>
            {[
            'AI CLASSIFIER',
            '3D MODELS',
            'LEARN',
            'ASSESSMENTS',
            'BOOKMARKS',
            'HISTORY',
            ].map((label, index) => (
            <View key={index} style={styles.iconItem}>
                <View style={styles.iconBox} />
                <Text style={styles.iconLabel}>{label}</Text>
            </View>
            ))}
        </View>

        {/* RECENT SCANS */}
        <Text style={styles.sectionTitle}>RECENT SCANS</Text>

        {[1, 2].map((_, index) => (
            <View key={index} style={styles.scanCard}>
            <View style={styles.scanPic} />

            <View style={styles.scanContent}>
                <View style={styles.scanHeader}>
                <Text style={styles.scanTitle}>YEAST</Text>
                <Ionicons name="bookmark-outline" size={16} />
                </View>

                <Text style={styles.meta}>DATE • CONFIDENCE</Text>

                <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionText}>LEARN MORE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionText}>VIEW MODEL</Text>
                </TouchableOpacity>
                </View>
            </View>
            </View>
        ))}

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scroll: {
        padding: 16,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    hello: {
        fontSize: 16,
        color: '#888',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
    },
    profilePic: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
    },
    picText: {
        fontSize: 12,
        color: '#555',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eee',
        padding: 8,
        borderRadius: 8,
        marginBottom: 20,
    },
    searchInput: {
        marginLeft: 8,
        flex: 1,
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    iconItem: {
        width: '30%',
        marginBottom: 16,
        alignItems: 'center',
    },
    iconBox: {
        width: 50,
        height: 50,
        backgroundColor: '#ccc',
        marginBottom: 8,
        borderRadius: 8,
    },
    iconLabel: {
        textAlign: 'center',
        fontSize: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    scanCard: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    scanPic: {
        width: 60,
        height: 60,
        backgroundColor: '#ccc',
        borderRadius: 8,
        marginRight: 12,
    },
    scanContent: {
        flex: 1,
    },
    scanHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    scanTitle: {
        fontWeight: 'bold',
    },
    meta: {
        fontSize: 12,
        color: '#666',
        marginBottom: 8,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#007bff',
        borderRadius: 4,
    },
    actionText: {
        color: '#fff',
        fontSize: 12,
    },
});
