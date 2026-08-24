import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, Image, ActivityIndicator, 
  ScrollView, StyleSheet, Platform, StatusBar, Modal 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function Scan({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [images, setImages] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); 
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  
  const [activeScanItemIndex, setActiveScanItemIndex] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Custom Modal Alert State
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    onConfirm: null,
    isDanger: false,
    hideCancel: false
  });

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
    try {
      const res = await api.get(`/scan/history/${id}`);
      setHistory(res.data.data.slice(0, 6)); 
    } catch (err) { 
      console.log("History fetch failed", err); 
    }
  };

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, visible: false }));

  const handleConfirmYes = () => {
    if (confirmModal.onConfirm) confirmModal.onConfirm();
    closeConfirm();
  };

  const pickImages = async (useCamera = false) => {
    if (result) {
      setResult(null);
      setActiveScanItemIndex(0);
      setCarouselIndex(0);
    }

    const remainingSlots = 6 - images.length;
    if (remainingSlots <= 0) {
      return toastError('You can only select up to 6 images.');
    }

    const options = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, 
      selectionLimit: remainingSlots, 
      quality: 0.8,
    };

    let res;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setConfirmModal({
          visible: true,
          title: 'Permission Required',
          message: 'Camera permission is required to scan specimens.',
          confirmText: 'OK',
          onConfirm: null,
          isDanger: false,
          hideCancel: true
        });
        return;
      }
      res = await ImagePicker.launchCameraAsync({ ...options, allowsMultipleSelection: false });
    } else {
      res = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!res.canceled) {
      const selectedAssets = res.assets.slice(0, remainingSlots);
      setImages(prev => [...prev, ...selectedAssets]);
    }
  };

  const removeImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (result) {
      setResult(null);
      setActiveScanItemIndex(0);
      setCarouselIndex(0);
    }
  };

  const handleScan = async () => {
    if (images.length === 0) return toastError('Please select images first.');
    if (!user?._id) return toastError('User not identified. Please login again.');
    
    setLoading(true);
    const formData = new FormData();
    formData.append('studentId', user._id);
    
    images.forEach((img, idx) => {
      formData.append('images', {
        uri: Platform.OS === 'android' ? img.uri : img.uri.replace('file://', ''),
        name: `photo_${idx}.jpg`,
        type: 'image/jpeg',
      });
    });

    try {
      const res = await api.post('/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data); 
      toastSuccess("Batch processing complete!");
      fetchHistory(user._id);
    } catch (err) {
      toastError("AI Service pipeline unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBookmark = async (item) => {
    try {
      const res = await api.put(`/scan-bookmark/${item._id}`);
      const updated = res.data.data;

      if (result) {
        setResult(prev => prev ? prev.map(r => r._id === item._id ? { ...r, bookmarked: updated.bookmarked } : r) : null);
      }
      setHistory(prev => prev.map(h => h._id === item._id ? { ...h, bookmarked: updated.bookmarked } : h));
      toastSuccess(updated.bookmarked ? "Saved to Bookmarks" : "Removed from Bookmarks");
    } catch (err) {
      toastError("Failed to update bookmark");
    }
  };

  const handleDeleteHistoryItem = (id) => {
    setConfirmModal({
      visible: true,
      title: 'Remove Scan',
      message: 'Remove this scan sequence from your history?',
      confirmText: 'Remove',
      isDanger: true,
      hideCancel: false,
      onConfirm: async () => {
        try {
          await api.delete(`/scan/history/item/${id}?studentId=${user._id}`);
          setHistory(prev => prev.filter(h => h._id !== id));
          if (result && result.some(r => r._id === id)) clearScanner();
          toastSuccess("Scan removed from history");
        } catch (e) {
          toastError("Failed to remove scan");
        }
      }
    });
  };

  const clearScanner = () => {
    setImages([]);
    setResult(null);
    setActiveScanItemIndex(0);
    setCarouselIndex(0);
  };

  const hasResult = Array.isArray(result) && result.length > 0;
  let currentScanItem = hasResult ? result[activeScanItemIndex] : null;

  if (currentScanItem && history.length > 0) {
    const historyMatch = history.find(h => h._id === currentScanItem._id);
    if (historyMatch && historyMatch.recommendedLessons) {
      currentScanItem = { ...currentScanItem, recommendedLessons: historyMatch.recommendedLessons };
    }
  }
  const currentSpeciesMatch = currentScanItem && currentScanItem.topSpecies ? currentScanItem.topSpecies[carouselIndex] : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      
      <View style={[styles.header, { backgroundColor: '#153c2a' }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>AI Scanner</Text>
          <Text style={styles.headerSubtitle}>
            Classify batch collections using microscopic images of fungi
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
        
        <View style={[styles.mainCard, { backgroundColor: theme.card }]}>
          {images.length === 0 ? (
            <View style={[styles.dropZone, { borderColor: theme.border }]}>
              <View style={styles.uploadIconCircle}>
                <Ionicons name="cloud-upload-outline" size={32} color="#153c2a" />
              </View>
              <Text style={[styles.dropText, { color: theme.text }]}>Upload Specimen Batches</Text>
              <Text style={{ color: theme.subText, fontSize: 13, marginBottom: 20 }}>Select up to 6 images (Max 10MB per item)</Text>
              
              <View style={styles.pickerRow}>
                <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: '#334155' }]} onPress={() => pickImages(false)}>
                  <Ionicons name="image-outline" size={18} color="#fff" />
                  <Text style={styles.pickerBtnText}>Library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => pickImages(true)}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.headerTitle && styles.pickerBtnText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.previewContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.batchThumbScroll}>
                {images.map((img, idx) => (
                  <View key={idx} style={styles.batchThumbWrapper}>
                    <Image source={{ uri: img.uri }} style={styles.batchPreviewThumb} />
                    <View style={styles.batchBadgeIndex}><Text style={styles.batchBadgeText}>{idx + 1}</Text></View>
                    
                    {!loading && !result && (
                      <TouchableOpacity 
                        style={styles.removeImgBtn} 
                        onPress={() => removeImage(idx)}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                
                {!loading && !result && images.length < 6 && (
                  <TouchableOpacity style={styles.addMoreThumbBtn} onPress={() => pickImages(false)}>
                    <Ionicons name="add" size={32} color="#153c2a" />
                  </TouchableOpacity>
                )}
              </ScrollView>
              
              {!result && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.scanBtn, loading && { opacity: 0.7 }]} onPress={handleScan} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Ionicons name="scan-outline" size={20} color="#fff" />
                        <Text style={styles.scanBtnText}>Classify ({images.length})</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelLink} onPress={clearScanner} disabled={loading}>
                    <Text style={{ color: theme.subText, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.statusBox}>
          <View style={styles.statusDot} />
          <Text style={[styles.statusTextPrimary, { flex: 1, lineHeight: 18 }]}>
            MyphoAI is an AI and can make mistakes with classifying images.
          </Text>
        </View>

        {hasResult && currentScanItem && (
          <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: '#10b981' }]}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultEyebrow}>BATCH CLASSIFYING RESULT</Text>
              <TouchableOpacity onPress={() => handleToggleBookmark(currentScanItem)}>
                <Ionicons 
                  name={currentScanItem.bookmarked ? "bookmark" : "bookmark-outline"} 
                  size={24} 
                  color={currentScanItem.bookmarked ? "#153c2a" : theme.subText} 
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.switchLabel, { color: theme.text }]}>Select specimen item tab analysis:</Text>
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
                {result.map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.tabChip, activeScanItemIndex === idx && styles.activeTabChip]}
                    onPress={() => {
                      setActiveScanItemIndex(idx);
                      setCarouselIndex(0);
                    }}
                  >
                    <Image source={{ uri: toAbsUrl(item.imageUrl) }} style={styles.tabChipImg} />
                    <Text style={[styles.tabChipText, activeScanItemIndex === idx && { color: '#fff' }]}>Item #{idx + 1}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.divider} />

            <Text style={[styles.resultTitle, { color: theme.text }]}>{currentScanItem.classification}</Text>
            
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceText}>{Number(currentScanItem.confidence).toFixed(2)}% Confidence Score</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${currentScanItem.confidence}%` }]} />
              </View>
            </View>

            {currentScanItem.explanation ? (
              <View style={styles.analysisContainer}>
                <Text style={[styles.sectionHeading, { color: theme.text }]}><Ionicons name="analytics" color="#059669" size={14}/> AI Structural Analysis</Text>
                <Text style={[styles.analysisBody, { color: theme.subText }]}>{currentScanItem.explanation}</Text>
              </View>
            ) : null}

            {currentSpeciesMatch && (
              <View style={styles.carouselContainer}>
                <View style={styles.carouselHeader}>
                  <Text style={[styles.carouselTitle, { color: theme.text }]}>Closest Matches Matrix</Text>
                  <Text style={styles.carouselCounter}>{carouselIndex + 1} / {currentScanItem.topSpecies.length}</Text>
                </View>

                <View style={styles.carouselCard}>
                  <Image source={{ uri: toAbsUrl(currentSpeciesMatch.imageUrl) }} style={styles.carouselCardImage} />
                  <View style={styles.carouselContent}>
                    <Text style={styles.speciesScientificName}>{currentSpeciesMatch.speciesName}</Text>
                    <Text style={styles.speciesDetailText}><Text style={{ fontWeight: 'bold' }}>Why it matches:</Text> {currentSpeciesMatch.matchReason}</Text>
                    <Text style={styles.speciesDetailText}><Text style={{ fontWeight: 'bold' }}>Clinical Manifestation:</Text> {currentSpeciesMatch.clinicalManifestation}</Text>
                  </View>
                </View>

                <View style={styles.carouselControlRow}>
                  <TouchableOpacity 
                    style={[styles.carouselControlBtn, carouselIndex === 0 && { opacity: 0.4 }]}
                    disabled={carouselIndex === 0}
                    onPress={() => setCarouselIndex(prev => Math.max(0, prev - 1))}
                  >
                    <Text style={styles.controlBtnText}>← Previous</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.carouselControlBtn, carouselIndex >= currentScanItem.topSpecies.length - 1 && { opacity: 0.4 }]}
                    disabled={carouselIndex >= currentScanItem.topSpecies.length - 1}
                    onPress={() => setCarouselIndex(prev => Math.min(currentScanItem.topSpecies.length - 1, prev + 1))}
                  >
                    <Text style={styles.controlBtnText}>Next →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {currentScanItem && (
              <View style={styles.lessonsContainer}>
                <Text style={[styles.sectionHeading, { color: theme.text, fontSize: 15, 
                  letterSpacing: 0.5, textTransform: 'uppercase' }]}>
                  Recommended Curriculum Reviewers
                </Text>
                
                {Array.isArray(currentScanItem.recommendedLessons) && currentScanItem.recommendedLessons.length > 0 ? (

                  currentScanItem.recommendedLessons.map((lesson, idx) => {
                    const isObj = typeof lesson === 'object' && lesson !== null;
                    const lessonId = isObj ? lesson._id : lesson;
                    const lessonTitle = isObj ? (lesson.title || lesson.pdfName || 'Review Module') : 'Review Module';

                    return (
                      <TouchableOpacity 
                        key={lessonId || idx} 
                        style={[styles.lessonRow, { backgroundColor: theme.bg, borderColor: '#e2e8f0', borderWidth: 1 }]}
                        onPress={() => navigation.navigate('Learn', { learnTab: 'Lessons' })} 
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 10 }}>
                          <Ionicons name="document-text" size={20} color="#153c2a" />
                          <Text style={[styles.lessonRowTitle, { color: theme.text, fontSize: 13 }]} numberOfLines={1}>
                            {lessonTitle}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#153c2a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Study Now</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                  
                ) : (
                  <Text style={{ fontSize: 12, opacity: 0.6, fontStyle: 'italic', color: theme.subText, marginTop: 4 }}>
                    No recommended lessons available
                  </Text>
                )}
              </View>
            )}
            
            <TouchableOpacity style={styles.scanAgainBtn} onPress={clearScanner}>
              <Ionicons name="reload-outline" size={16} color="#153c2a" />
              <Text style={styles.scanAgainText}>Classify Another</Text>
            </TouchableOpacity>
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeaderRow}>
              <Text style={[styles.historyTitle, { color: theme.text }]}>Recent Scans</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ScanHistory')}>
                <Text style={{ color: '#153c2a', fontWeight: 'bold' }}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {history.map((item, index) => {
              const d = new Date(item.createdAt);
              const timeString = d.toLocaleDateString();

              return (
                <View key={item._id || index} style={[styles.historyItem, { backgroundColor: theme.card }]}>
                  <Image source={{ uri: toAbsUrl(item.imageUrl) }} style={styles.historyThumb} />
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyClass, { color: theme.text }]}>{item.classification}</Text>
                    <Text style={styles.historyMeta}>
                      {Number(item.confidence).toFixed(1)}% accuracy • {timeString}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TouchableOpacity onPress={() => handleToggleBookmark(item)}>
                          <Ionicons 
                              name={item.bookmarked ? "bookmark" : "bookmark-outline"} 
                              size={22} 
                              color={item.bookmarked ? "#153c2a" : theme.subText} 
                          />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteHistoryItem(item._id)}>
                          <Ionicons name="trash-outline" size={22} color="#EF4444" />
                      </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* --- CUSTOM CONFIRMATION MODAL --- */}
      <Modal visible={confirmModal.visible} transparent animationType="fade" onRequestClose={closeConfirm}>
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.card || '#fff' }]}>
            <View style={styles.confirmHeader}>
              <Ionicons 
                name={confirmModal.isDanger ? "warning" : "information-circle"} 
                size={28} 
                color={confirmModal.isDanger ? "#EF4444" : "#153c2a"} 
              />
              <Text style={[styles.confirmTitle, { color: theme.text || '#000' }]}>
                {confirmModal.title}
              </Text>
            </View>
            
            <Text style={[styles.confirmMessage, { color: theme.subText || '#64748B' }]}>
              {confirmModal.message}
            </Text>
            
            <View style={styles.confirmActionRow}>
              {!confirmModal.hideCancel && (
                <TouchableOpacity style={styles.confirmCancelBtn} onPress={closeConfirm}>
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.confirmActionBtn, { backgroundColor: confirmModal.isDanger ? '#EF4444' : '#153c2a' }]} 
                onPress={handleConfirmYes}
              >
                <Text style={styles.confirmActionText}>{confirmModal.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  header: { 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 23,
    borderBottomLeftRadius: 10, 
    borderBottomRightRadius: 10, 
    width: '100%',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerTop: { 
    flexDirection: 'column', 
    alignItems: 'center',    
    justifyContent: 'center' 
  },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#fff', 
    marginTop: 5,
    textAlign: 'center'
  },
  headerSubtitle: { 
    fontSize: 13, 
    color: '#d1fae5', 
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 10  
  },
  mainCard: { borderRadius: 10, padding: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 15 },
  dropZone: { width: '100%', minHeight: 200, borderRadius: 10, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center', padding: 20 },
  uploadIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  dropText: { fontWeight: '900', fontSize: 16, marginBottom: 4 },
  pickerRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 10 },
  pickerBtn: { flex: 1, backgroundColor: '#153c2a', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, borderRadius: 10, gap: 6 },
  pickerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  previewContainer: { width: '100%' },
  batchThumbScroll: { gap: 10, paddingVertical: 10 },
  batchThumbWrapper: { position: 'relative' },
  batchPreviewThumb: { width: 110, height: 110, borderRadius: 10, resizeMode: 'cover', borderWidth: 1, borderColor: '#e2e8f0' },
  batchBadgeIndex: { position: 'absolute', top: 6, left: 6, backgroundColor: '#153c2a', width: 22, height: 22, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  batchBadgeText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, gap: 15 },
  scanBtn: { flex: 1, backgroundColor: '#153c2a', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 50, borderRadius: 10, gap: 8 },
  scanBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  cancelLink: { paddingHorizontal: 10 },
  statusBox: { backgroundColor: '#f7e9cb', padding: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#faefd1' },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ffbb00', marginRight: 10 },
  statusTextPrimary: { color: '#be710b', fontWeight: '900', fontSize: 12.5 },
  statusTextSecondary: { color: '#065f46', fontSize: 13, opacity: 0.8 },
  resultCard: { padding: 20, borderRadius: 10, borderWidth: 2, marginBottom: 20 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultEyebrow: { fontSize: 15, fontWeight: '900', color: '#059669', letterSpacing: 1 },
  switchLabel: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  tabStrip: { gap: 8, paddingBottom: 10 },
  tabChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 8, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: '#e2e8f0' },
  activeTabChip: { backgroundColor: '#153c2a', borderColor: '#153c2a' },
  tabChipImg: { width: 24, height: 24, borderRadius: 4 },
  tabChipText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
  resultTitle: { fontSize: 24, fontWeight: '900', marginBottom: 8 },
  confidenceRow: { marginBottom: 12 },
  confidenceText: { fontSize: 15, fontWeight: '900', color: '#10b981', marginBottom: 6 },
  progressBarBg: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  resultDesc: { fontSize: 15, lineHeight: 22, opacity: 0.8, marginBottom: 15 },
  analysisContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  sectionHeading: { fontSize: 13, fontWeight: '800', marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  analysisBody: { fontSize: 13, lineHeight: 18, textAlign: 'justify' },
  carouselContainer: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginBottom: 15 },
  carouselHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  carouselTitle: { fontSize: 15, fontWeight: '800' },
  carouselCounter: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
  carouselCard: { backgroundColor: '#f8fafc', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#f1f5f9' },
  carouselCardImage: { width: '100%', height: 130, resizeMode: 'cover' },
  carouselContent: { padding: 12 },
  speciesScientificName: { fontSize: 15, fontWeight: 'bold', color: '#153c2a', fontStyle: 'italic', marginBottom: 6 },
  speciesDetailText: { fontSize: 13, color: '#334155', lineHeight: 16, marginTop: 4, textAlign: 'justify' },
  carouselControlRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  carouselControlBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  controlBtnText: { fontSize: 15, fontWeight: '700', color: '#153c2a' },
  lessonsContainer: { marginBottom: 15 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, marginBottom: 6, gap: 8 },
  lessonRowTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  scanAgainBtn: { backgroundColor: '#f1f5f9', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  scanAgainText: { color: '#153c2a', fontWeight: '900', fontSize: 15 },
  historySection: { marginTop: 10 },
  historyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  historyTitle: { fontSize: 15, fontWeight: '900', color: '#153c2a', textTransform: 'uppercase' },
  historyItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 10 },
  historyThumb: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#f1f5f9' },
  historyInfo: { flex: 1, marginLeft: 12 },
  historyClass: { fontWeight: '900', fontSize: 15, marginBottom: 3 },
  historyMeta: { fontSize: 13, color: '#64748b' },
  removeImgBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  addMoreThumbBtn: {
    width: 110,
    height: 110,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#153c2a',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: 'rgba(21, 60, 42, 0.05)',
  },
  // Modal Styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  confirmCard: { 
    width: '100%', 
    borderRadius: 16, 
    padding: 24, 
    elevation: 5, 
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowRadius: 10 
  },
  confirmHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    gap: 10 
  },
  confirmTitle: { 
    fontSize: 20, 
    fontWeight: '900' 
  },
  confirmMessage: { 
    fontSize: 15, 
    lineHeight: 22, 
    marginBottom: 24 
  },
  confirmActionRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 12 
  },
  confirmCancelBtn: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 10, 
    backgroundColor: '#F1F5F9' 
  },
  confirmCancelText: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#64748B' 
  },
  confirmActionBtn: { 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 10 
  },
  confirmActionText: { 
    fontSize: 15, 
    fontWeight: '800', 
    color: '#FFF' 
  },
});