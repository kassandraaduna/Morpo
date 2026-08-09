import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Platform, StatusBar, Modal, TextInput, } from 'react-native';
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
    const [activeTab, setActiveTab] = useState('lessons'); // 'lessons' or 'assessments'
    const [searchQuery, setSearchQuery] = useState('');
    const [archivedLessons, setArchivedLessons] = useState([]);
    const [archivedAssessments, setArchivedAssessments] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);

    const fetchArchived = async () => {
        try {
        setLoading(true);
        
        // Get the currently logged-in instructor
        const userRaw = await AsyncStorage.getItem('user');
        if (!userRaw) return;
        const currentUser = JSON.parse(userRaw);
        setUser(currentUser);

        // Fetch all items (including archived) from the backend
        const [lessonsRes, assessmentsRes] = await Promise.all([
            api.get(`/lessons?includeArchived=true&instructorId=${currentUser._id}`),
            api.get(`/assessments?includeArchived=true&instructorId=${currentUser._id}`)
        ]);

        const allLessons = lessonsRes.data?.data || [];
        const allAssessments = assessmentsRes.data?.data || [];

        // STRICT FILTER: Must be archived AND belong to this specific instructor
        const myArchivedLessons = allLessons.filter(item => {
            const creatorId = typeof item.createdBy === 'object' ? item.createdBy?._id : item.createdBy;
            return item.isArchived === true && creatorId === currentUser._id;
        });

        const myArchivedAssessments = allAssessments.filter(item => {
            const creatorId = typeof item.createdBy === 'object' ? item.createdBy?._id : item.createdBy;
            return item.isArchived === true && creatorId === currentUser._id;
        });

        // Update state with the filtered data
        setArchivedLessons(myArchivedLessons);
        setArchivedAssessments(myArchivedAssessments);
        
        } catch (err) {
        console.error("Error fetching archives:", err);
        toastError("Failed to load your archived items.");
        } finally {
        setLoading(false);
        }
    };

    // --- TRIGGER FETCH ON SCREEN FOCUS ---
    useFocusEffect(
        useCallback(() => {
        fetchArchived();
        }, [])
    );

    // --- =RESET SELECTIONS ON TAB SWITCH ---
    useEffect(() => {
        setSelectedIds([]);
        setSearchQuery('');
    }, [activeTab]);

    // Determine which data to render based on the active tab
    const currentData = activeTab === 'lessons' ? archivedLessons : archivedAssessments;
    
    // Apply Search Filter
    const filteredData = currentData.filter(item =>
        item.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleSelect = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredData.length && filteredData.length > 0) {
            setSelectedIds([]); 
        } else {
            setSelectedIds(filteredData.map(item => item._id)); 
        }
    };

    const handleRestore = (id) => {
        const itemName = activeTab === 'lessons' ? 'lesson' : 'assessment';
        setModalConfig({
            visible: true,
            title: `Restore ${itemName.charAt(0).toUpperCase() + itemName.slice(1)}`,
            message: `Are you sure you want to restore this ${itemName} to the active module?`,
            confirmText: 'Restore',
            isDestructive: false,
            onConfirm: async () => {
                closeActionModal();
                try {
                    const formData = new FormData();
                    formData.append('isArchived', 'false');
                    if (user?._id) formData.append('modifiedBy', String(user._id));

                    await api.put(getEndpoint(id), formData, { 
                        headers: { 'Content-Type': 'multipart/form-data' } 
                    });
                    
                    toastSuccess(`${itemName} restored successfully.`);
                    
                    // Update the correct state dynamically
                    if (activeTab === 'lessons') {
                        setArchivedLessons(prev => prev.filter(item => item._id !== id));
                    } else {
                        setArchivedAssessments(prev => prev.filter(item => item._id !== id));
                    }
                    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id)); 
                } catch (error) {
                    toastError(`Failed to restore ${itemName}.`);
                }
            }
        });
    };

    const handleDelete = (id) => {
        const itemName = activeTab === 'lessons' ? 'lesson' : 'assessment';
        setModalConfig({
            visible: true,
            title: 'Delete Permanently',
            message: `Are you sure you want to permanently delete this ${itemName}? This action cannot be undone.`,
            confirmText: 'Delete',
            isDestructive: true,
            onConfirm: async () => {
                closeActionModal();
                try {
                    await api.delete(getEndpoint(id));
                    toastSuccess(`${itemName} deleted permanently.`);
                    
                    // Update the correct state dynamically
                    if (activeTab === 'lessons') {
                        setArchivedLessons(prev => prev.filter(item => item._id !== id));
                    } else {
                        setArchivedAssessments(prev => prev.filter(item => item._id !== id));
                    }
                    setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
                } catch (error) {
                    toastError(`Failed to delete ${itemName}.`);
                }
            }
        });
    };

    const handleBatchRestore = () => {
        if (selectedIds.length === 0) return;
        setModalConfig({
            visible: true,
            title: `Restore Multiple ${activeTab}`,
            message: `Are you sure you want to restore ${selectedIds.length} selected ${activeTab}?`,
            confirmText: 'Restore All',
            isDestructive: false,
            onConfirm: async () => {
                closeActionModal();
                try {
                    await Promise.all(selectedIds.map(id => {
                        const formData = new FormData();
                        formData.append('isArchived', 'false');
                        if (user?._id) formData.append('modifiedBy', String(user._id));
                        return api.put(getEndpoint(id), formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                    }));
                    toastSuccess(`${selectedIds.length} items restored.`);
                    
                    // Update the correct state
                    if (activeTab === 'lessons') {
                        setArchivedLessons(prev => prev.filter(item => !selectedIds.includes(item._id)));
                    } else {
                        setArchivedAssessments(prev => prev.filter(item => !selectedIds.includes(item._id)));
                    }
                    setSelectedIds([]); 
                } catch (error) {
                    toastError("Failed to restore some items.");
                }
            }
        });
    };

    const handleBatchDelete = () => {
        if (selectedIds.length === 0) return;
        setModalConfig({
            visible: true,
            title: `Delete Multiple ${activeTab}`,
            message: `Permanently delete ${selectedIds.length} selected ${activeTab}? This cannot be undone.`,
            confirmText: 'Delete All',
            isDestructive: true,
            onConfirm: async () => {
                closeActionModal();
                try {
                    await Promise.all(selectedIds.map(id => api.delete(getEndpoint(id))));
                    toastSuccess(`${selectedIds.length} items deleted.`);
                    
                    if (activeTab === 'lessons') {
                        setArchivedLessons(prev => prev.filter(item => !selectedIds.includes(item._id)));
                    } else {
                        setArchivedAssessments(prev => prev.filter(item => !selectedIds.includes(item._id)));
                    }
                    setSelectedIds([]); 
                } catch (error) {
                    toastError("Failed to delete some items.");
                }
            }
        });
    };

    const [modalConfig, setModalConfig] = useState({
        visible: false,
        title: '',
        message: '',
        confirmText: '',
        isDestructive: false,
        onConfirm: () => {}
    });

const closeActionModal = () => setModalConfig({ ...modalConfig, visible: false });

    useEffect(() => { fetchArchived(); }, []);



    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />

            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>

                <View style={localStyles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 70, justifyContent: 'center' }}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={[localStyles.title, { textAlign: 'center' }]}>Archives</Text>
                        <Text style={[localStyles.subtitle, { textAlign: 'center' }]}>Restore or permanently delete lessons and assessments</Text>
                    </View>

                    <View style={{ width: 70, alignItems: 'flex-end', justifyContent: 'center' }}>
                        {archived.length > 0 && (
                            <TouchableOpacity onPress={toggleSelectAll} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name={selectedIds.length === filteredData.length ? "checkmark-circle" : "ellipse-outline"} size={24} color="#FFF" />
                                <Text style={{ color: '#FFF', marginLeft: 4, fontWeight: 'bold' }}>All</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <View style={localStyles.searchContainer}>
                    <Ionicons name="search" size={20} color="#94A3B8" style={localStyles.searchIcon} />
                    <TextInput
                        style={localStyles.searchInput}
                        placeholder={`Search archived ${activeTab}...`}
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

<View style={localStyles.tabContainer}>
    <TouchableOpacity 
        style={[localStyles.tabButton, activeTab === 'lessons' && localStyles.activeTab]}
        onPress={() => setActiveTab('lessons')}
    >
        <Text style={[localStyles.tabText, activeTab === 'lessons' && localStyles.activeTabText]}>
            Lessons
        </Text>
    </TouchableOpacity>

    <TouchableOpacity 
        style={[localStyles.tabButton, activeTab === 'assessments' && localStyles.activeTab]}
        onPress={() => setActiveTab('assessments')}
    >
        <Text style={[localStyles.tabText, activeTab === 'assessments' && localStyles.activeTabText]}>
            Assessments
        </Text>
    </TouchableOpacity>
</View>

            {loading ? (
                <View style={localStyles.centered}>
                    <ActivityIndicator size="large" color="#153c2a" />
                </View>
            ) : (
                <FlatList
                    data={filteredData}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{ paddingVertical: 20, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={localStyles.centered}>
                            <Ionicons name="file-tray-outline" size={50} color="#ccc" />
                            <Text style={{ marginTop: 10, color: '#999' }}>No archived lessons found.</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const isSelected = selectedIds.includes(item._id);
                        return (
                            <TouchableOpacity 
                                style={[
                                    localStyles.lessonCard, 
                                    { backgroundColor: theme.card },
                                    isSelected && { borderColor: '#153c2a', borderWidth: 2 }
                                ]}
                                onPress={() => toggleSelect(item._id)}
                                activeOpacity={0.8}
                            >

                                <View style={{ marginRight: 15, justifyContent: 'center' }}>
                                    <Ionicons 
                                        name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                                        size={24} 
                                        color={isSelected ? "#153c2a" : "#94A3B8"} 
                                    />
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={[localStyles.cardTitle, { color: theme.text }]}>
                                        {item.title}
                                    </Text>
                                    <Text style={localStyles.cardMeta}>
                                        Archived on: {moment(item.updatedAt).format('MM/DD/YY')}
                                    </Text>
                                </View>
                                <View style={localStyles.actionRow}>
                                    <TouchableOpacity onPress={() => handleRestore(item._id)} style={localStyles.actionBtn}>
                                        <Ionicons name="refresh-circle" size={28} color="#0ec21d" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(item._id)} style={localStyles.actionBtn}>
                                        <Ionicons name="trash" size={24} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {selectedIds.length > 0 && (
                <View style={localStyles.batchActionBar}>
                    <Text style={localStyles.batchText}>{selectedIds.length} Selected</Text>
                    
                    <View style={localStyles.batchButtons}>
                        <TouchableOpacity style={localStyles.batchRestoreBtn} onPress={handleBatchRestore}>
                            <Ionicons name="refresh" size={20} color="#FFF" />
                            <Text style={localStyles.batchBtnText}>Restore</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={localStyles.batchDeleteBtn} onPress={handleBatchDelete}>
                            <Ionicons name="trash" size={20} color="#FFF" />
                            <Text style={localStyles.batchBtnText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalConfig.visible}
                onRequestClose={closeActionModal}
            >
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContainer}>
                        <Text style={localStyles.modalTitle}>{modalConfig.title}</Text>
                        <Text style={localStyles.modalMessage}>{modalConfig.message}</Text>
                        
                        <View style={localStyles.modalButtonGroup}>
                            <TouchableOpacity 
                                style={[localStyles.modalBtn, localStyles.cancelBtn]} 
                                onPress={closeActionModal}
                            >
                                <Text style={localStyles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[
                                    localStyles.modalBtn, 
                                    modalConfig.isDestructive ? localStyles.confirmDeleteBtn : localStyles.confirmRestoreBtn
                                ]} 
                                onPress={modalConfig.onConfirm}
                            >
                                <Text style={localStyles.confirmBtnText}>{modalConfig.confirmText}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { 
        paddingHorizontal: 20, 
        paddingTop: Platform.OS === 'ios' ? 60 : 40, 
        paddingBottom: 25, 
        borderBottomLeftRadius: 10, 
        borderBottomRightRadius: 10 
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
        borderRadius: 10,
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
    },
    batchActionBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFF',
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    batchText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#153c2a',
    },
    batchButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    batchRestoreBtn: {
        flexDirection: 'row',
        backgroundColor: '#0ec21d', 
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    batchDeleteBtn: {
        flexDirection: 'row',
        backgroundColor: '#EF4444', 
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    batchBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        marginLeft: 5,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darkened background
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#FFF',
        width: '90%',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#153c2a',
        marginBottom: 10,
    },
    modalMessage: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 25,
        lineHeight: 22,
    },
    modalButtonGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelBtn: {
        backgroundColor: '#F1F5F9',
    },
    cancelBtnText: {
        color: '#64748B',
        fontWeight: '700',
        fontSize: 15,
    },
    confirmRestoreBtn: {
        backgroundColor: '#153c2a',
    },
    confirmDeleteBtn: {
        backgroundColor: '#EF4444',
    },
    confirmBtnText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        marginHorizontal: 15,
        marginTop: 15,
        marginBottom: 5,
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 45,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1E293B',
    },
    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 15,
        marginBottom: 15,
        marginTop: 10,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    tabText: {
        fontWeight: '600',
        color: '#64748B',
        fontSize: 14,
    },
    activeTabText: {
        color: '#153c2a',
        fontWeight: '700',
    },
});