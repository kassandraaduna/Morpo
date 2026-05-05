import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';
import api from './src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toastSuccess, toastError } from './src/components/ToastMsg';
import moment from 'moment';

export default function ArchiveLessons({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const [archived, setArchived] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    const fetchArchived = async () => {
        try {
            setLoading(true);
            const u = await AsyncStorage.getItem('user');
            if (u) setUser(JSON.parse(u));

            const res = await api.get('/lessons?includeArchived=true'); 
            const allLessons = res.data?.data || [];
            const onlyArchived = allLessons.filter(l => l.isArchived === true);
            setArchived(onlyArchived);
        } catch (err) { 
            toastError("Failed to load archive"); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleRestore = async (id) => {
        Alert.alert(
            "Restore Lesson",
            "Are you sure you want to restore this lesson to the active library?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Restore",
                    onPress: async () => {
                        try {
                            await api.put(`/lessons/${id}`, { 
                                isArchived: false,
                                modifiedBy: user?._id 
                            });
                            toastSuccess("Lesson restored!");
                            fetchArchived();
                        } catch (e) { 
                            toastError("Restore failed"); 
                        }
                    }
                }
            ]
        );
    };

    const handleDeletePermanently = async (id) => {
        Alert.alert(
            "Permanent Delete", 
            "This will permanently delete the lesson. This action cannot be undone.", 
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            await api.delete(`/lessons/${id}`);
                            
                            toastSuccess("Lesson permanently deleted");

                            fetchArchived(); 
                        } catch (e) {
                            console.error(e);
                            toastError("Failed to delete from server");
                        }
                    } 
                }
            ]
        );
    };

    useEffect(() => { fetchArchived(); }, []);

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />
            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={localStyles.title}>Archived Lessons</Text>
                        <Text style={localStyles.subtitle}>Restore or permanently delete lessons</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View style={localStyles.centered}>
                    <ActivityIndicator size="large" color="#153c2a" />
                </View>
            ) : (
                <FlatList
                    data={archived}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{ paddingVertical: 20 }}
                    ListEmptyComponent={
                        <View style={localStyles.centered}>
                            <Ionicons name="file-tray-outline" size={50} color="#ccc" />
                            <Text style={{ marginTop: 10, color: '#999' }}>No archived lessons found.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={[localStyles.lessonCard, { backgroundColor: theme.card }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[localStyles.cardTitle, { color: theme.text }]}>
                                    {item.title}
                                </Text>
                                <Text style={localStyles.cardMeta}>
                                    Archived on: {moment(item.updatedAt).format('MM/DD/YY')}
                                </Text>
                            </View>
                            <View style={localStyles.actionRow}>
                                <TouchableOpacity 
                                    onPress={() => handleRestore(item._id)} 
                                    style={localStyles.actionBtn}
                                >
                                    <Ionicons name="refresh-circle" size={28} color="#153c2a" />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => handleDeletePermanently(item._id)} 
                                    style={localStyles.actionBtn}
                                >
                                    <Ionicons name="trash" size={24} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { 
        paddingHorizontal: 20, 
        paddingTop: Platform.OS === 'ios' ? 60 : 40, 
        paddingBottom: 25, 
        borderBottomLeftRadius: 30, 
        borderBottomRightRadius: 30 
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 20 },
    subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 50
    },
    lessonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 22,
        marginHorizontal: 20,
        marginBottom: 12,
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '800'
    },
    cardMeta: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4,
        fontWeight: '600'
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    actionBtn: {
        padding: 8,
        marginLeft: 4
    }
});