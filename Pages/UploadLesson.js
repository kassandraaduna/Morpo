import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ScrollView, 
  ActivityIndicator, StyleSheet, Platform, Alert 
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function UploadLesson({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [instructorId, setInstructorId] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then(u => {
      if (u) setInstructorId(JSON.parse(u)._id);
    });
  }, []);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setFile(result.assets[0]);
        if (!title) {
          const fileName = result.assets[0].name.replace('.pdf', '');
          setTitle(fileName);
        }
      }
    } catch (err) {
      toastError("Error picking document");
    }
  };

  const handleUpload = async () => {
    if (!file) return toastError("Please select a PDF file");
    if (!title.trim()) return toastError("Please enter a lesson title");

    setLoading(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('createdBy', instructorId);
    
    formData.append('lessonPdf', {
      uri: file.uri,
      name: file.name,
      type: 'application/pdf',
    });

    try {
      await api.post('/lessons', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toastSuccess("Lesson uploaded successfully!");
      navigation.goBack();
    } catch (err) {
      console.log(err.response?.data);
      toastError(err.response?.data?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color={theme.text} />
        </TouchableOpacity>
        <Text style={[localStyles.headerTitle, { color: theme.text }]}>Upload Lesson</Text>
        <View style={{ width: 26 }} /> 
      </View>

      <ScrollView contentContainerStyle={{ padding: 25 }}>
        <Text style={[localStyles.label, { color: theme.subText }]}>LESSON TITLE</Text>
        <TextInput 
          style={[localStyles.input, { backgroundColor: theme.card, color: theme.text }]} 
          placeholder="e.g. Introduction to Ascomycota"
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[localStyles.label, { color: theme.subText, marginTop: 25 }]}>PDF DOCUMENT</Text>
        <TouchableOpacity 
          style={[localStyles.dropZone, { borderColor: file ? '#153c2a' : '#ccc', backgroundColor: theme.card }]} 
          onPress={pickDocument}
        >
          <Ionicons 
            name={file ? "document-check" : "cloud-upload-outline"} 
            size={40} 
            color={file ? "#153c2a" : "#999"} 
          />
          <Text style={[localStyles.dropText, { color: theme.text }]}>
            {file ? file.name : "Tap to select PDF"}
          </Text>
          <Text style={{ color: '#999', fontSize: 11, marginTop: 5 }}>Max file size: 50MB</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[localStyles.uploadBtn, { opacity: loading ? 0.7 : 1 }]} 
          onPress={handleUpload}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="arrow-up-circle" size={20} color="#fff" />
              <Text style={localStyles.uploadBtnText}>PUBLISH LESSON</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  label: { fontSize: 10, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
  input: { padding: 15, borderRadius: 12, fontSize: 16, elevation: 2 },
  dropZone: { width: '100%', height: 180, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  dropText: { fontWeight: 'bold', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  uploadBtn: { backgroundColor: '#153c2a', height: 55, borderRadius: 15, marginTop: 40, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  uploadBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 }
});