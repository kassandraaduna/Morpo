import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  StyleSheet, Platform, StatusBar, Image, Modal 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';

import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function ScanHistory({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All'); 

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
      actionType: null, // 'clearAll' | 'deleteSingle'
  });

  const closeActionModal = () => {
      setModalConfig({ visible: false, title: '', message: '', targetId: null, actionType: null });
  };

  useEffect(() => {
    const init = async () => {
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        setUser(u);
        fetchHistory(u._id);
      }
    };
    init();
  }, []);

  const fetchHistory = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/scan/history/${id}`);
      const data = res.data.data || [];
      setHistory(data);
      setFilteredHistory(data);
    } catch (err) {
      toastError("Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeFilter === 'All') {
      setFilteredHistory(history);
    } else {
      setFilteredHistory(history.filter(item => 
        item.classification?.toLowerCase().includes(activeFilter.toLowerCase())
      ));
    }
  }, [activeFilter, history]);

  const handleClearAll = () => {
    if (history.length === 0) return toastError("History is already empty.");

    setModalConfig({
        visible: true,
        title: "Clear All History",
        message: "Are you sure you want to delete all your scan history? This action cannot be undone.",
        targetId: null,
        actionType: 'clearAll'
    });
  };

  const handleDeleteItem = (id) => {
    setModalConfig({
        visible: true,
        title: "Delete Scan",
        message: "Remove this scan from your history? This action cannot be undone.",
        targetId: id,
        actionType: 'deleteSingle'
    });
  };

  const executeModalAction = async () => {
    const { targetId, actionType } = modalConfig;
    closeActionModal();

    try {
        setLoading(true);
        if (actionType === 'clearAll') {
            await api.delete(`/scan/history/${user._id}`);
            setHistory([]);
            setFilteredHistory([]);
            toastSuccess("All scan history cleared.");
        } else if (actionType === 'deleteSingle') {
            await api.delete(`/scan/history/item/${targetId}?studentId=${user._id}`);
            setHistory(prev => prev.filter(h => h._id !== targetId));
            setFilteredHistory(prev => prev.filter(h => h._id !== targetId));
            toastSuccess("Scan deleted.");
        }
    } catch (e) {
        toastError(actionType === 'clearAll' ? "Failed to clear history." : "Failed to delete scan.");
    } finally {
        setLoading(false);
    }
  };

  const handleToggleBookmark = async (item) => {
    try {
      const res = await api.put(`/scan-bookmark/${item._id}`);
      const updated = res.data.data;
      setHistory(prev => prev.map(h => h._id === item._id ? { ...h, bookmarked: updated.bookmarked } : h));
      toastSuccess(updated.bookmarked ? "Saved to Bookmarks" : "Removed from Bookmarks");
    } catch (err) {
      toastError("Failed to update bookmark");
    }
  };

  // Download Logic capturing the white background layout
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

  const renderItem = ({ item }) => {
    const d = new Date(item.createdAt);
    const timeString = d.toLocaleDateString() + ' • ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    return (
      <TouchableOpacity 
        style={[styles.cardWrapper, { backgroundColor: theme.card }]}
        onPress={() => setSelectedScan(item)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: toAbsUrl(item.imageUrl) }} style={styles.scanThumb} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.classification}</Text>
          <Text style={{ color: theme.subText, fontSize: 12 }}>{Number(item.confidence).toFixed(1)}% Confidence Score</Text>
          <Text style={{ color: theme.subText, fontSize: 12, marginTop: 4 }}>{timeString}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => handleToggleBookmark(item)}>
            <Ionicons 
              name={item.bookmarked ? "bookmark" : "bookmark-outline"} 
              size={24} 
              color={item.bookmarked ? "#10b981" : theme.subText} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => handleDeleteItem(item._id)}>
            <Ionicons name="trash-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Scan History</Text>
            <Text style={styles.subtitle}>View or clear your past batch logs</Text>
          </View>
          <TouchableOpacity onPress={handleClearAll} style={styles.rightBtn}>
             <Ionicons name="trash-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabWrapper}>
        {['All', 'Yeast', 'Mold'].map((tab) => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tabItem, activeFilter === tab && styles.activeTab]} 
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.tabLabel, { color: activeFilter === tab ? '#153c2a' : '#64748B' }]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.disclaimerBox}>
        <Ionicons name="information-circle" size={18} color="#059669" />
        <Text style={styles.disclaimerText}>
          Bookmarked sequence matrices are kept safe. Non-bookmarked items are cleared automatically after 30 days.
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#153c2a" /></View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="document-text-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>No scans found</Text>
            </View>
          }
        />
      )}

      {/* Custom Confirmation Modal */}
      <Modal animationType="fade" transparent={true} visible={modalConfig.visible} onRequestClose={closeActionModal}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                  <Text style={styles.modalTitle}>{modalConfig.title}</Text>
                  <Text style={styles.modalMessage}>{modalConfig.message}</Text>
                  <View style={styles.modalButtonGroup}>
                      <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={closeActionModal}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                          style={[styles.modalBtn, styles.confirmDeleteBtn]} 
                          onPress={executeModalAction}
                      >
                          <Text style={styles.confirmBtnText}>{modalConfig.actionType === 'clearAll' ? 'Clear All' : 'Remove'}</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

      {/* White Report Card Modal for Exporting */}
      <Modal visible={!!selectedScan} transparent={true} animationType="fade" onRequestClose={() => setSelectedScan(null)}>
          <View style={styles.fsModalBackground}>
              <View style={styles.fsModalHeader}>
                  <TouchableOpacity onPress={() => setSelectedScan(null)} style={styles.fsIconButton}>
                      <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                      onPress={downloadScanWithMetadata} 
                      style={styles.fsIconButton}
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
                  <View ref={captureViewRef} collapsable={false} style={styles.exportCard}>
                      <View style={styles.exportBrandRow}>
                          <Text style={styles.exportBrandText}>MyphoAI Analysis</Text>
                      </View>
                      <Image 
                          source={{ uri: toAbsUrl(selectedScan.imageUrl) }} 
                          style={styles.exportImage} 
                      />
                      <View style={styles.exportData}>
                          <Text style={styles.exportTitle}>{selectedScan.classification || 'Unknown'}</Text>
                          <Text style={styles.exportScore}>{Number(selectedScan.confidence).toFixed(1)}% Confidence Match</Text>
                          <Text style={styles.exportDate}>Scanned on {new Date(selectedScan.createdAt).toLocaleString()}</Text>
                      </View>
                  </View>
              )}
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#153c2a', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  backBtn: { position: 'absolute', left: 0, zIndex: 10 },
  rightBtn: { position: 'absolute', right: 0, zIndex: 10 },
  headerTextContainer: { alignItems: 'center', paddingHorizontal: 45 },
  title: { fontSize: 25, fontWeight: '900', color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2, textAlign: 'center' },
  tabWrapper: { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabLabel: { fontSize: 13, fontWeight: '800' },
  disclaimerBox: { marginHorizontal: 20, marginTop: 15, padding: 12, backgroundColor: '#ecfdf5', borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderColor: '#d1fae5', borderWidth: 1 },
  disclaimerText: { color: '#065f46', fontSize: 13, fontWeight: '600', marginLeft: 8, flex: 1 },
  cardWrapper: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 10, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  scanThumb: { width: 55, height: 55, borderRadius: 10, backgroundColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },

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
  exportTitle: { fontSize: 22, fontWeight: '900', color: '#153c2a', marginBottom: 6 },
  exportScore: { fontSize: 15, fontWeight: '800', color: '#10B981', marginBottom: 6 },
  exportDate: { fontSize: 13, fontWeight: '600', color: '#64748B' }
});