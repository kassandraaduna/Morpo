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

export default function Scan() {
  const { theme } = useContext(ThemeContext);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [studentId, setStudentId] = useState(null);

  useEffect(() => {
    const init = async () => {
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        setStudentId(user._id);
        fetchHistory(user._id);
      }
    };
    init();
  }, []);

  const fetchHistory = async (id) => {
    try {
      const res = await api.get(`/scan/history/${id}`);
      setHistory(res.data.data.slice(0, 5)); 
    } catch (err) { console.log("History fetch failed"); }
  };

  const pickImage = async (useCamera = false) => {
    setResult(null);
    const options = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9], 
      quality: 0.7,
    };

    let res;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return toastError('Camera permission is required to scan samples.');
      res = await ImagePicker.launchCameraAsync(options);
    } else {
      res = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!res.canceled) setImage(res.assets[0]);
  };

const handleScan = async () => {
  if (!image) return toastError('Please select an image');
  setLoading(true);

  const formData = new FormData();
  formData.append('studentId', studentId);
  formData.append('file', {
    uri: Platform.OS === 'android' ? image.uri : image.uri.replace('file://', ''),
    name: 'photo.jpg',
    type: 'image/jpeg',
  });

  try {
    const res = await api.post('/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setResult(res.data.data);
    fetchHistory(studentId);
  } catch (err) {
    toastError("AI Service unavailable. Please try again.");
  } finally {
    setLoading(false);
  }
};

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 50 }}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      
      <View style={localStyles.header}>
        <Text style={[localStyles.title, { color: theme.text }]}>AI Scanner</Text>
        <Text style={[localStyles.subtitle, { color: theme.subText }]}>
          Classify fungi using macroscopic or microscopic images.
        </Text>
      </View>

      <View style={localStyles.mainCard}>
        {!image ? (
          <View style={[localStyles.dropZone, { borderColor: theme.subText + '44', backgroundColor: theme.card }]}>
            <View style={localStyles.uploadIconCircle}>
              <Ionicons name="cloud-upload-outline" size={30} color={theme.text} />
            </View>
            <Text style={[localStyles.dropText, { color: theme.text }]}>Drag & drop image here</Text>
            <Text style={{ color: theme.subText, fontSize: 11, marginBottom: 15 }}>Support for JPG, PNG or TIFF (Max 10MB)</Text>
            
            <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={localStyles.browseBtn} onPress={() => pickImage(false)}>
                    <Text style={localStyles.btnText}>Browse Files</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[localStyles.browseBtn, { backgroundColor: '#2d6a4f' }]} onPress={() => pickImage(true)}>
                    <Ionicons name="camera" size={16} color="#fff" />
                    <Text style={[localStyles.btnText, { marginLeft: 5 }]}>Use Camera</Text>
                </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={localStyles.previewContainer}>
            <Text style={[localStyles.previewLabel, { color: theme.text }]}>Image Preview</Text>
            <Image source={{ uri: image.uri }} style={localStyles.previewImage} />
            
            <View style={localStyles.actionRow}>
              <TouchableOpacity 
                style={[localStyles.scanBtn, { backgroundColor: '#153c2a' }]} 
                onPress={handleScan}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <><Ionicons name="flash" size={18} color="#fff" /><Text style={localStyles.scanBtnText}> SCAN IMAGE</Text></>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={localStyles.cancelBtn} 
                onPress={() => {setImage(null); setResult(null);}}
                disabled={loading}
              >
                <Text style={{ color: '#333', fontWeight: 'bold' }}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={[localStyles.statusBox, { backgroundColor: '#e6f4ea' }]}>
          <View style={localStyles.dot} />
          <Text style={{ color: '#153c2a', fontWeight: 'bold', fontSize: 12 }}>AI ENGINE ACTIVE</Text>
          <Text style={{ color: '#153c2a', fontSize: 12 }}> - Processing available</Text>
      </View>

      {result && (
        <View style={localStyles.resultArea}>
          <Text style={[localStyles.sectionLabel, { color: theme.subText }]}>Scan Result</Text>
          <Text style={[localStyles.resultClass, { color: theme.text }]}>{result.classification}</Text>
          <Text style={[localStyles.resultConf, { color: theme.text }]}>{Number(result.confidence).toFixed(1)}% confidence</Text>
          <Text style={[localStyles.resultDesc, { color: theme.subText }]}>{result.description}</Text>
        </View>
      )}

      <View style={{ paddingHorizontal: 20, marginTop: 30 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' }}>
          <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 18 }}>Recent Scans</Text>
          <TouchableOpacity><Text style={{ color: theme.primary, fontWeight: 'bold' }}>View All</Text></TouchableOpacity>
        </View>
        
        {history.map((item, index) => (
          <View key={index} style={[localStyles.historyItem, { backgroundColor: theme.card }]}>
            <Image source={{ uri: `${SERVER_URL}${item.imageUrl}` }} style={localStyles.historyThumb} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.text, fontWeight: 'bold' }}>{item.classification}</Text>
              <Text style={{ color: theme.subText, fontSize: 11 }}>{Number(item.confidence).toFixed(1)}% confidence</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.subText} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: 5, lineHeight: 18, opacity: 0.8 },
  mainCard: { paddingHorizontal: 20 },
  dropZone: { width: '100%', height: 220, borderRadius: 20, borderStyle: 'dashed', borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', padding: 20 },
  uploadIconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  dropText: { fontWeight: 'bold', fontSize: 17, marginBottom: 4 },
  browseBtn: { backgroundColor: '#153c2a', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  previewContainer: { width: '100%' },
  previewLabel: { fontWeight: '800', marginBottom: 12, fontSize: 16 },
  previewImage: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#eee' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  scanBtn: { flex: 2, height: 54, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  scanBtnText: { color: '#fff', fontWeight: 'bold', letterSpacing: 0.5, fontSize: 15 },
  cancelBtn: { flex: 1, height: 54, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  statusBox: { margin: 20, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981', marginRight: 10 },
  resultArea: { paddingHorizontal: 20, marginTop: 10 },
  sectionLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  resultClass: { fontSize: 24, fontWeight: '900', marginTop: 5 },
  resultConf: { fontSize: 16, fontWeight: '700', marginTop: 2, opacity: 0.9 },
  resultDesc: { fontSize: 14, marginTop: 10, lineHeight: 22 },
  historyItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 12, elevation: 1 },
  historyThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#eee' }
});