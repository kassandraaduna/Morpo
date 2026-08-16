import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import { 
    View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
    RefreshControl, StyleSheet, StatusBar, Platform, Image, 
    TextInput, Modal 
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native'; 
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';

import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import api, { toAbsUrl } from './src/services/api';

export default function Bookmarks({ navigation, route }) {
    const { theme } = useContext(ThemeContext);
    const [activeTab, setActiveTab] = useState(route.params?.initialTab?.toLowerCase() || 'lessons'); 
    const [data, setData] = useState({ lessons: [], models: [], scans: [] });
    const [filteredData, setFilteredData] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState(null);
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Fullscreen Export & ViewShot State
    const [selectedScan, setSelectedScan] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const captureViewRef = useRef();

    // Custom UI Alert / Confirm Modal State
    const [modalConfig, setModalConfig] = useState({
        visible: false,
        title: '',
        message: '',
        targetId: null,
    });

    const closeActionModal = () => {
        setModalConfig({ visible: false, title: '', message: '', targetId: null });
    };

    const fetchData = async () => { 
        try { 
            const rawUser = await AsyncStorage.getItem('user');
            if (!rawUser) {
                setLoading(false);
                setRefreshing(false);
                return;
            }
            const currentUser = JSON.parse(rawUser);
            setUser(currentUser);

            const savedBookmarksRaw = await AsyncStorage.getItem('studentBookmarks_v1');
            const savedBookmarks = savedBookmarksRaw ? JSON.parse(savedBookmarksRaw) : { lessons: [], models: [], scans: [] };
            const bookmarkedLessonIds = savedBookmarks.lessons || [];
            const bookmarkedModelIds = savedBookmarks.models || [];

            const [lessonRes, modelRes, scanRes, remedialRes] = await Promise.all([ 
                api.get('/lessons').catch(() => ({ data: { data: [] } })),
                api.get('/models3d').catch(() => ({ data: { data: [] } })), 
                api.get('/scan/history/' + currentUser._id).catch(() => ({ data: { data: [] } })),
                api.get('/ai/personalized-lessons/' + currentUser._id).catch(() => ({ data: { data: [] } }))
            ]);

            const rawNormal = (lessonRes.data?.data || []).filter(l => !l.isArchived);
            const normalLessons = rawNormal
                .map(l => ({ ...l, type: 'normal' }))
                .filter(l => bookmarkedLessonIds.includes(l._id)); 

            const rawRemedial = remedialRes.data?.data || [];
            const remedialLessons = rawRemedial
                .map(l => ({ ...l, type: 'remedial', title: `Remedial: ${l.topic}`, pdfName: 'Personalized AI Content' }))
                .filter(l => bookmarkedLessonIds.includes(l._id)); 

            const rawModels = modelRes.data?.data || [];
            const filteredModels = rawModels.filter(m => bookmarkedModelIds.includes(m._id));

            const rawScans = scanRes.data?.data || [];
            const bookmarkedScans = rawScans.filter(s => s.bookmarked === true);

            setData({
                lessons: [...normalLessons, ...remedialLessons], 
                models: filteredModels, 
                scans: bookmarkedScans 
            });
        } catch (err) { 
            console.error("Bookmark Fetch Error:", err);
        } finally {
            setLoading(false); 
            setRefreshing(false); 
        } 
    };

    useFocusEffect(useCallback(() => { 
        setLoading(true);
        fetchData(); 
    }, []));

    useEffect(() => {
        const list = data[activeTab] || [];
        if (!searchQuery.trim()) {
            setFilteredData(list);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = list.filter(item => {
                const itemName = (item.title || item.classification || '').toLowerCase();
                return itemName.includes(query);
            });
            setFilteredData(filtered);
        }
    }, [searchQuery, activeTab, data]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const deleteScanHistoryItem = (id) => {
        setModalConfig({
            visible: true,
            title: "Hide Scan",
            message: "Remove this scan from your history? This action cannot be undone.",
            targetId: id
        });
    };

    const handleConfirmAction = async () => {
        const { targetId } = modalConfig;
        closeActionModal();
        if (!targetId) return;

        try {
            await api.delete(`/scan/history/item/${targetId}?studentId=${user._id}`);
            
            setData(prev => ({
                ...prev,
                scans: prev.scans.filter(s => s._id !== targetId)
            }));
            
            toastSuccess("Scan removed");
        } catch (e) {
            toastError("Failed to remove scan");
        }
    };

    // New Download Logic capturing the white background layout
    const downloadScanWithMetadata = async () => {
        try {
            setIsDownloading(true);

            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                toastError('Gallery permission is required to save images.');
                return;
            }

            // Capture the exact layout of the export card
            const uri = await captureRef(captureViewRef, {
                format: 'jpg',
                quality: 1,
            });
            
            await MediaLibrary.saveToLibraryAsync(uri);
            toastSuccess("Scan saved to your gallery!");
        } catch (err) {
            toastError('Failed to download image.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleRemoveBookmark = async (itemId, type) => {
        try {
            if (type === 'scan') {
                await api.put(`/scan-bookmark/${itemId}`);
                setData(prev => ({
                    ...prev,
                    scans: prev.scans.filter(s => s._id !== itemId)
                }));
                toastSuccess('Removed from Bookmarks');
            } else {
                const savedBookmarksRaw = await AsyncStorage.getItem('studentBookmarks_v1');
                let savedBookmarks = savedBookmarksRaw ? JSON.parse(savedBookmarksRaw) : { lessons: [], models: [], scans: [] };
                
                if (savedBookmarks[type]) {
                    savedBookmarks[type] = savedBookmarks[type].filter(id => id !== itemId);
                    await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(savedBookmarks));
                }

                setData(prev => ({
                    ...prev,
                    [type]: prev[type].filter(item => item._id !== itemId)
                }));
                toastSuccess('Removed from Bookmarks');
            }
        } catch (error) {
            toastError('Failed to remove bookmark.');
        }
    };

    const renderLessonItem = ({ item }) => {
        const modifierName = item.modifiedBy ? `${item.modifiedBy.fname} ${item.modifiedBy.lname}` : 'Instructor';
        const dateStr = new Date(item.updatedAt || item.createdAt).toLocaleDateString();

        return (
            <TouchableOpacity
                style={[localStyles.listItemCard, { backgroundColor: theme?.card || '#FFF' }]}
                onPress={() => navigation.navigate('LessonStudent', { lessonId: item._id || item.id })}
            >
                <View style={[localStyles.iconBox, { backgroundColor: '#F0F9F4' }]}>
                    <Ionicons name="book" size={26} color="#153c2a" />
                </View>

                <View style={localStyles.itemInfo}>
                    <Text style={[localStyles.itemTitle, { color: theme?.text || '#000' }]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={localStyles.itemSubtitle} numberOfLines={1}>
                        Modified by {modifierName}
                    </Text>
                    <Text style={localStyles.itemMeta}>
                        Last updated: {dateStr}
                    </Text>
                </View>

                <TouchableOpacity style={localStyles.bookmarkBtn} onPress={() => handleRemoveBookmark(item._id || item.id, 'lessons')}>
                    <Ionicons name="bookmark" size={24} color="#153c2a" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const renderScanItem = ({ item }) => {
        const d = new Date(item.createdAt);
        const timeString = d.toLocaleDateString();
        
        return (
            <TouchableOpacity 
                style={[localStyles.cardWrapper, { backgroundColor: theme.card }]}
                onPress={() => setSelectedScan(item)}
                activeOpacity={0.8}
            >
                <Image source={{ uri: toAbsUrl(item.imageUrl) }} style={localStyles.scanThumb} />
                
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[localStyles.cardTitle, { color: theme.text }]}>{item.classification}</Text>
                    <Text style={{ color: theme.subText, fontSize: 12 }}>{Number(item.confidence).toFixed(1)}% Confidence Score</Text>
                    <Text style={{ color: theme.subText, fontSize: 12, marginTop: 2 }}>{timeString}</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <TouchableOpacity style={{ padding: 8 }} onPress={() => handleRemoveBookmark(item._id, 'scan')}>
                        <Ionicons name="bookmark" size={22} color="#153c2a" />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ padding: 8 }} onPress={() => deleteScanHistoryItem(item._id)}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    const renderModelItem = ({ item }) => {
        const finalUrl = toAbsUrl(item.fileUrl);
        const thumbHtml = `
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
                    <style>body { margin: 0; background-color: #f0f4f2; display: flex; justify-content: center; } model-viewer { width: 100vw; height: 100vh; --poster-color: transparent; }</style>
                </head>
                <body><model-viewer src="${finalUrl}" auto-rotate rotation-per-second="30deg" interaction-prompt="none" shadow-intensity="1"></model-viewer></body>
            </html>
        `;

        return (
            <View style={[localStyles.modelCard, { backgroundColor: theme.card }]}>
                <View style={localStyles.modelThumbContainer}>
                    <WebView scrollEnabled={false} source={{ html: thumbHtml }} style={{ backgroundColor: '#f0f4f2' }} />
                    <TouchableOpacity style={localStyles.bookmarkFloat} onPress={() => handleRemoveBookmark(item._id, 'models')}>
                        <Ionicons name="bookmark" size={20} color="#153c2a" />
                    </TouchableOpacity>
                </View>
                <View style={localStyles.modelInfo}>
                    <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: '#6b6b6b', fontSize: 12, fontWeight: '400', marginTop: 5 }}>{item.description}</Text>
                    <TouchableOpacity 
                        style={[localStyles.viewBtn, { backgroundColor: '#153c2a' }]}
                        onPress={() => navigation.navigate('ModelViewerMobile', { modelId: item._id, modelTitle: item.title, modelUrl: item.fileUrl, labels: item.labels })}
                    >
                        <Text style={localStyles.viewBtnText}>VIEW 3D MODEL</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <StatusBar barStyle="light-content" />
            
            <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
                <View style={localStyles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backBtn}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={localStyles.headerTextContainer}>
                        <Text style={localStyles.headerTitle}>Bookmarks</Text>
                    </View>
                </View>

                <View style={localStyles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput 
                        placeholder={`Search ${activeTab}...`}
                        style={localStyles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            <View style={localStyles.tabWrapper}>
                {['lessons', 'models', 'scans'].map((tab) => (
                    <TouchableOpacity key={tab} style={[localStyles.tabItem, activeTab === tab && localStyles.activeTab]} onPress={() => setActiveTab(tab)}>
                        <Text style={[localStyles.tabLabel, { color: activeTab === tab ? '#153c2a' : '#64748B' }]}>
                            {tab === 'models' ? '3D MODELS' : tab.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeTab === 'scans' && (
                <View style={localStyles.disclaimerBox}>
                    <Ionicons name="information-circle" size={20} color="#059669" />
                    <Text style={localStyles.disclaimerText}>
                        Bookmarked scans are kept safe. Non-bookmarked scans are automatically archived after 30 days.
                    </Text>
                </View>
            )}

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#153c2a" /></View>
            ) : (
                <FlatList
                    data={filteredData}
                    keyExtractor={(item) => item._id}
                    renderItem={activeTab === 'lessons' ? renderLessonItem : (activeTab === 'models' ? renderModelItem : renderScanItem)}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor="#153c2a" />}
                    ListEmptyComponent={
                        <View style={localStyles.emptyState}>
                            <Ionicons name="bookmark-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>No Bookmarks Yet</Text>
                        </View>
                    }
                />
            )}

            <Modal animationType="fade" transparent={true} visible={modalConfig.visible} onRequestClose={closeActionModal}>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContainer}>
                        <Text style={localStyles.modalTitle}>{modalConfig.title}</Text>
                        <Text style={localStyles.modalMessage}>{modalConfig.message}</Text>
                        <View style={localStyles.modalButtonGroup}>
                            <TouchableOpacity style={[localStyles.modalBtn, localStyles.cancelBtn]} onPress={closeActionModal}>
                                <Text style={localStyles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[localStyles.modalBtn, localStyles.confirmDeleteBtn]} 
                                onPress={handleConfirmAction}
                            >
                                <Text style={[localStyles.confirmBtnText, { color: '#FFF' }]}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!selectedScan} transparent={true} animationType="fade" onRequestClose={() => setSelectedScan(null)}>
                <View style={localStyles.fsModalBackground}>
                    <View style={localStyles.fsModalHeader}>
                        <TouchableOpacity onPress={() => setSelectedScan(null)} style={localStyles.fsIconButton}>
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={downloadScanWithMetadata} 
                            style={localStyles.fsIconButton}
                            disabled={isDownloading}
                        >
                            {isDownloading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Ionicons name="download-outline" size={26} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {selectedScan && (
                        <View ref={captureViewRef} collapsable={false} style={localStyles.exportCard}>
                            <View style={localStyles.exportBrandRow}>
                                <Text style={localStyles.exportBrandText}>MyphoAI Analysis</Text>
                            </View>
                            <Image 
                                source={{ uri: toAbsUrl(selectedScan.imageUrl) }} 
                                style={localStyles.exportImage} 
                            />
                            <View style={localStyles.exportData}>
                                <Text style={localStyles.exportTitle}>{selectedScan.classification || 'Unknown'}</Text>
                                <Text style={localStyles.exportScore}>{Number(selectedScan.confidence).toFixed(1)}% Confidence Match</Text>
                                <Text style={localStyles.exportDate}>Scanned on {new Date(selectedScan.createdAt).toLocaleString()}</Text>
                            </View>
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' },
    backBtn: { position: 'absolute', left: 0, zIndex: 10 },
    headerTextContainer: { alignItems: 'center', paddingHorizontal: 35 },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center' },
    searchContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 15, height: 45, alignItems: 'center' },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600' },
    tabWrapper: { flexDirection: 'row', marginHorizontal: 22, marginTop: 20, marginBottom: 10, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4 },
    tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    activeTab: { backgroundColor: '#fff', elevation: 2 },
    tabLabel: { fontSize: 13, fontWeight: '800' },
    
    disclaimerBox: { marginHorizontal: 20, marginTop: 15, padding: 12, backgroundColor: '#ecfdf5', borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderColor: '#d1fae5', borderWidth: 1 },
    disclaimerText: { color: '#065f46', fontSize: 12, fontWeight: '600', marginLeft: 8, flex: 1 },

    cardWrapper: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 10, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    cardTitle: { fontSize: 16, fontWeight: 'bold' },
    scanThumb: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#eee' },

    modelCard: { borderRadius: 10, marginBottom: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    modelThumbContainer: { height: 200, backgroundColor: '#f0f4f2', position: 'relative' },
    modelInfo: { padding: 16 },
    viewBtn: { marginTop: 15, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    viewBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    bookmarkFloat: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 10, zIndex: 10 },
    
    emptyState: { alignItems: 'center', marginTop: 80 },

    listItemCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 10, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    iconBox: { width: 56, height: 56, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    itemInfo: { flex: 1 },
    itemTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
    itemSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500', marginBottom: 4 },
    itemMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
    bookmarkBtn: { padding: 8 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContainer: { backgroundColor: '#FFF', width: '90%', borderRadius: 10, padding: 25, alignItems: 'center', elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#153c2a', marginBottom: 10 },
    modalMessage: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    modalButtonGroup: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 5 },
    cancelBtn: { backgroundColor: '#F1F5F9' },
    cancelBtnText: { color: '#64748B', fontWeight: '700', fontSize: 15 },
    confirmDeleteBtn: { backgroundColor: '#EF4444' },
    confirmBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },

    fsModalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    fsModalHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
    fsIconButton: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 30 },
    
    exportCard: {
        backgroundColor: '#FFFFFF',
        width: '85%',
        borderRadius: 10,
        overflow: 'hidden',
        padding: 20,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 15,
    },
    exportBrandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 6 },
    exportBrandText: { fontSize: 14, fontWeight: '800', color: '#153c2a', textTransform: 'uppercase', letterSpacing: 0.5 },
    exportImage: {
        width: '100%',
        height: 320,
        borderRadius: 10,
        resizeMode: 'cover',
        backgroundColor: '#F1F5F9',
        marginBottom: 20,
    },
    exportData: {
        width: '100%',
        backgroundColor: '#F8FAFC',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    exportTitle: { fontSize: 25, fontWeight: '900', color: '#153c2a', marginBottom: 6 },
    exportScore: { fontSize: 15, fontWeight: '800', color: '#10B981', marginBottom: 6 },
    exportDate: { fontSize: 13, fontWeight: '600', color: '#64748B' }
});