import React, { useState, useEffect, useContext } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import styles from './src/styles/Styles';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function Learn({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const init = async () => {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) setUser(JSON.parse(storedUser));
      fetchLessons();
    };
    init();
  }, []);

  const isInstructor = (user?.role || '').toLowerCase() === 'instructor';

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const res = await api.get('/lessons');
      setLessons(res.data.data || []);
    } catch (err) {
      toastError('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  // This function is safely ignored by students since the button won't render
  const uploadLesson = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setUploading(true);
      const file = result.assets[0];

      const formData = new FormData();
      formData.append('title', file.name.replace('.pdf', ''));
      formData.append('createdBy', user?._id);
      formData.append('lessonPdf', {
        uri: file.uri,
        name: file.name,
        type: 'application/pdf',
      });

      const res = await api.post('/lessons', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setLessons([res.data.data, ...lessons]);
      toastSuccess('Lesson uploaded successfully!');
    } catch (err) {
      toastError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filteredLessons = lessons.filter(l => 
    String(l?.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: 40, alignItems: 'stretch' }]}>
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <View>
            <Text style={[styles.appTitle, { color: theme.text }]}>Educational</Text>
            <Text style={{ color: theme.subText, fontSize: 12 }}>
              {isInstructor ? 'Manage and upload learning modules.' : 'Explore learning modules.'}
            </Text>
          </View>

          {/* ROLE CHECK: Only render the upload button if the user is an instructor */}
          {isInstructor && (
            <TouchableOpacity 
              style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}
              onPress={uploadLesson}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="cloud-upload" size={16} color="#000" />}
              <Text style={{ color: '#000', fontWeight: 'bold', marginLeft: 5 }}>Upload</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.search, borderColor: theme.subText }]}>
          <Ionicons name="search-outline" size={18} color="#777" />
          <TextInput
            placeholder="Search lessons..."
            placeholderTextColor="#999"
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredLessons}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}
          ListEmptyComponent={<Text style={{ color: theme.subText, textAlign: 'center' }}>No active lessons.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.assessmentCard, { backgroundColor: theme.card, flexDirection: 'column' }]}
              onPress={() => navigation.navigate('LessonStudent', { lessonId: item._id })}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.assessmentTitle, { color: theme.text, fontSize: 16 }]}>{item.title}</Text>
                <Ionicons name="document-text" size={20} color={theme.primary} />
              </View>
              <Text style={[styles.assessmentMeta, { color: theme.subText, marginTop: 6 }]}>
                {item.pdfName || 'PDF Document'}
              </Text>
              <Text style={[styles.assessmentFeedback, { color: theme.subText, marginTop: 6 }]}>
                Added: {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}