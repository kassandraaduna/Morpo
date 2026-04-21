import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, Image, ActivityIndicator, 
  ScrollView, StyleSheet, Platform, StatusBar 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

const SERVER_URL = 'http://192.168.1.24:8000';

export default function Scan({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

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
      setHistory(res.data.data.slice(0, 5)); 
    } catch (err) { 
      console.log("History fetch failed", err); 
    }
  };

  const pickImage = async (useCamera = false) => {
    setResult(null);
    const options = {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3], 
      quality: 0.8,
    };

    let res;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission Required', 'Camera permission is required to scan samples.');
      }
      res = await ImagePicker.launchCameraAsync(options);
    } else {
      res = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!res.canceled) setImage(res.assets[0]);
  };

  const handleScan = async () => {
    if (!image) return toastError('Please select an image first.');
    if (!user?._id) return toastError('User not identified. Please login again.');
    
    setLoading(true);

    const formData = new FormData();
    formData.append('studentId', user._id);
    formData.append('image', {
      uri: Platform.OS === 'android' ? image.uri : image.uri.replace('file://', ''),
      name: 'photo.jpg',
      type: 'image/jpeg',
    });

    try {
      const res = await api.post('/scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data);
      toastSuccess("Scan complete!");
      fetchHistory(user._id);
    } catch (err) {
      toastError("AI Service unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBookmark = async (item) => {
    try {
      const res = await api.put(`/scan-bookmark/${item._id}`);
      const updated = res.data.data;

      if (result && result._id === item._id) {
        setResult({ ...result, bookmarked: updated.bookmarked });
      }

      setHistory(prev => prev.map(h => h._id === item._id ? { ...h, bookmarked: updated.bookmarked } : h));

      toastSuccess(updated.bookmarked ? "Saved to Bookmarks" : "Removed from Bookmarks");
    } catch (err) {
      toastError("Failed to update bookmark");
    }
  };

  const handleDeleteHistoryItem = (id) => {
    Alert.alert(
      "Remove Scan", 
      "Remove this scan from your history?", 
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            try {
              await api.delete(`/scan/history/item/${id}?studentId=${user._id}`);
              setHistory(prev => prev.filter(h => h._id !== id));
              if (result && result._id === id) setResult(null);
              
              toastSuccess("Scan removed from your history");
            } catch (e) {
              toastError("Failed to remove scan");
            }
          }
        }
      ]
    );
  };

  const clearScanner = () => {
    setImage(null);
    setResult(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      
      <View style={[styles.header, { backgroundColor: '#153c2a' }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>AI Scanner</Text>
          <Text style={styles.headerSubtitle}>
            Classify fungi using macroscopic or microscopic images
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
        
        <View style={[styles.mainCard, { backgroundColor: theme.card }]}>
          {!image ? (
            <View style={[styles.dropZone, { borderColor: theme.border }]}>
              <View style={styles.uploadIconCircle}>
                <Ionicons name="cloud-upload-outline" size={32} color="#153c2a" />
              </View>
              <Text style={[styles.dropText, { color: theme.text }]}>Upload Specimen Image</Text>
              <Text style={{ color: theme.subText, fontSize: 12, marginBottom: 20 }}>JPG, PNG or TIFF (Max 10MB)</Text>
              
              <View style={styles.pickerRow}>
                <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: '#334155' }]} onPress={() => pickImage(false)}>
                  <Ionicons name="image-outline" size={18} color="#fff" />
                  <Text style={styles.pickerBtnText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerBtn} onPress={() => pickImage(true)}>
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                  <Text style={styles.pickerBtnText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.previewContainer}>
              <View style={styles.imageWrapper}>
                <Image source={{ uri: image.uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.clearBtn} onPress={clearScanner} disabled={loading}>
                  <Ionicons name="close" size={20} color="#333" />
                </TouchableOpacity>
              </View>
              
              {!result && (
                <TouchableOpacity 
                  style={[styles.scanBtn, loading && { opacity: 0.7 }]} 
                  onPress={handleScan}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="scan-outline" size={20} color="#fff" />
                      <Text style={styles.scanBtnText}>Classify Image</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View style={styles.statusBox}>
          <View style={styles.statusDot} />
          <Text style={styles.statusTextPrimary}>AI ENGINE ACTIVE</Text>
          <Text style={styles.statusTextSecondary}> - Ready to process</Text>
        </View>

        {result && (
          <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: '#10b981' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.resultEyebrow}>SCAN RESULT</Text>
                <TouchableOpacity onPress={() => handleToggleBookmark(result)}>
                    <Ionicons 
                        name={result.bookmarked ? "bookmark" : "bookmark-outline"} 
                        size={24} 
                        color={result.bookmarked ? "#059669" : theme.subText} 
                    />
                </TouchableOpacity>
            </View>
            
            <Text style={[styles.resultTitle, { color: theme.text }]}>{result.classification}</Text>
            
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceText}>{Number(result.confidence).toFixed(1)}% Confidence</Text>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${result.confidence}%` }]} />
              </View>
            </View>

            <Text style={[styles.resultDesc, { color: theme.text }]}>
              {result.description || (String(result.classification).toLowerCase().includes('yeast')
                ? 'Yeasts are unicellular fungi that commonly reproduce by budding. They often appear pasty or mucoid.'
                : 'Molds are multicellular fungi characterized by filamentous hyphae and spore production.')}
            </Text>
            
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
                <Text style={{ color: '#059669', fontWeight: 'bold' }}>View All</Text>
              </TouchableOpacity>
            </View>
            
            {history.map((item, index) => {
              const d = new Date(item.createdAt);
              const isToday = d.toDateString() === new Date().toDateString();
              const timeString = isToday 
                ? `Today, ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
                : d.toLocaleDateString();

              return (
                <View key={item._id || index} style={[styles.historyItem, { backgroundColor: theme.card }]}>
                  <Image source={{ uri: `${SERVER_URL}${item.imageUrl}` }} style={styles.historyThumb} />
                  <View style={styles.historyInfo}>
                    <Text style={[styles.historyClass, { color: theme.text }]}>{item.classification}</Text>
                    <Text style={styles.historyMeta}>
                      {Number(item.confidence).toFixed(1)}% confidence • {timeString}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <TouchableOpacity onPress={() => handleToggleBookmark(item)}>
                          <Ionicons 
                              name={item.bookmarked ? "bookmark" : "bookmark-outline"} 
                              size={22} 
                              color={item.bookmarked ? "#059669" : theme.subText} 
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
    </View>
  );
}

const styles = StyleSheet.create({
header: { 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30
  },
  headerTop: { 
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 20 
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '900', 
    color: '#fff',
    marginTop: 20,
  },
  headerSubtitle: { 
    fontSize: 13, 
    color: '#d1fae5', 
    marginTop: 2 
  },
  mainCard: { 
    borderRadius: 20, 
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    marginBottom: 15
  },
  dropZone: { 
    width: '100%', 
    minHeight: 220, 
    borderRadius: 16, 
    borderStyle: 'dashed', 
    borderWidth: 2, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.01)'
  },
  uploadIconCircle: { 
    width: 60, height: 60, 
    borderRadius: 30, 
    backgroundColor: '#f1f5f9', 
    justifyContent: 'center', alignItems: 'center', 
    marginBottom: 12 
  },
  dropText: { fontWeight: '900', fontSize: 16, marginBottom: 4 },
  pickerRow: { flexDirection: 'row', gap: 12, width: '100%' },
  pickerBtn: { 
    flex: 1, backgroundColor: '#153c2a', 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    paddingVertical: 14, borderRadius: 12, gap: 6 
  },
  pickerBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  previewContainer: { width: '100%' },
  imageWrapper: { position: 'relative', width: '100%', height: 260, borderRadius: 16, overflow: 'hidden', marginBottom: 15 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  clearBtn: { 
    position: 'absolute', top: 12, right: 12, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    width: 32, height: 32, borderRadius: 16, 
    justifyContent: 'center', alignItems: 'center' 
  },
  scanBtn: { 
    backgroundColor: '#153c2a', 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    height: 54, borderRadius: 12, gap: 8, elevation: 2 
  },
  scanBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 },
  statusBox: { 
    backgroundColor: '#ecfdf5', padding: 14, borderRadius: 12, 
    flexDirection: 'row', alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#d1fae5'
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginRight: 10 },
  statusTextPrimary: { color: '#065f46', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  statusTextSecondary: { color: '#065f46', fontSize: 12, opacity: 0.8 },
  resultCard: { 
    padding: 20, borderRadius: 16, borderWidth: 2, marginBottom: 20,
    elevation: 2, shadowColor: '#10b981', shadowOpacity: 0.1, shadowRadius: 10
  },
  resultEyebrow: { fontSize: 11, fontWeight: '900', color: '#059669', letterSpacing: 1 },
  resultTitle: { fontSize: 24, fontWeight: '900', marginBottom: 12 },
  confidenceRow: { marginBottom: 15 },
  confidenceText: { fontSize: 14, fontWeight: '900', color: '#10b981', marginBottom: 6 },
  progressBarBg: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
  resultDesc: { fontSize: 14, lineHeight: 22, opacity: 0.8, marginBottom: 20 },
  scanAgainBtn: { 
    backgroundColor: '#f1f5f9', padding: 14, borderRadius: 12, 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6
  },
  scanAgainText: { color: '#153c2a', fontWeight: '900', fontSize: 14 },
  historySection: { marginTop: 10 },
  historyHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  historyTitle: { fontSize: 14, fontWeight: '900', color: '#153c2a', letterSpacing: 1.2, textTransform: 'uppercase',  },
  historyItem: { 
    flexDirection: 'row', alignItems: 'center', padding: 12, 
    borderRadius: 14, marginBottom: 10, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }
  },
  historyThumb: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#f1f5f9' },
  historyInfo: { flex: 1, marginLeft: 12 },
  historyClass: { fontWeight: '900', fontSize: 15, marginBottom: 3 },
  historyMeta: { fontSize: 12, color: '#64748b', fontWeight: '600' }
});