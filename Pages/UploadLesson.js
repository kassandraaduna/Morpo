import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Switch, StyleSheet, Platform, Alert, StatusBar } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import styles from './src/styles/Styles';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function UploadLesson({ navigation, route }) {
  const { theme } = useContext(ThemeContext);
  const editingLesson = route.params?.lesson || null; 
  const isEditing = !!editingLesson;
  const [title, setTitle] = useState(editingLesson?.title || '');
  const [description, setDescription] = useState(editingLesson?.description || '');
  const [content, setContent] = useState(editingLesson?.content || '');
  const [isArchived, setIsArchived] = useState(editingLesson?.is_archived === true || editingLesson?.is_archived === 1);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [instructorId, setInstructorId] = useState(null);
  const [hasActiveAssignment, setHasActiveAssignment] = useState(true);

  useEffect(() => {
      const verifyInstructorAssignment = async () => {
          try {
              const rawUser = await AsyncStorage.getItem('user');
              if (!rawUser) return;
              const currentUser = JSON.parse(rawUser);

              // If user is not an instructor, let it pass through or handle accordingly
              if (currentUser.role !== 'instructor') return;

              const syRes = await api.get('/admin/academic-settings/school-years');
              const syContext = syRes.data?.context || {};
              const activeSyId = syContext.activeSchoolYearId;
              const activeTermKey = syContext.activeTermKey;

              const assignments = Array.isArray(currentUser.instructorAssignments) ? currentUser.instructorAssignments : [];
              const isActive = assignments.some(a => 
                  String(a.schoolYearId) === String(activeSyId) && 
                  (a.termKey === 'all' || a.termKey === activeTermKey)
              );

              setHasActiveAssignment(isActive);
          } catch (error) {
              console.error("Assignment check failed", error);
          }
      };

      verifyInstructorAssignment();
  }, []);

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
          setTitle(result.assets[0].name.replace('.pdf', ''));
        }
      }
    } catch (err) {
      toastError("Error picking document");
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return toastError("Please enter a lesson title");
    if (!editingLesson && !file) return toastError("Please select a PDF file");

    Alert.alert(
      editingLesson ? "Update Lesson" : "Publish Lesson",
      editingLesson ? "Are you sure you want to save changes to this lesson?" : "Are you sure you want to publish this new lesson?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            setLoading(true);
            const formData = new FormData();
            formData.append('title', title);
            formData.append('educationalContent', content);
            formData.append('isArchived', isArchived ? 'true' : 'false');
            formData.append('createdBy', instructorId);
            formData.append('modifiedBy', instructorId);
            
            if (file) {
              formData.append('lessonPdf', {
                uri: file.uri,
                name: file.name,
                type: 'application/pdf',
              });
            }

            try {
              if (editingLesson) {
                await api.put(`/lessons/${editingLesson._id}`, formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                toastSuccess("Lesson updated successfully!");
              } else {
                await api.post('/lessons', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                toastSuccess("Lesson published successfully!");
              }
              navigation.goBack();
            } catch (err) {
              toastError(err.response?.data?.message || "Action failed");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
        <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
          <View style={localStyles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{justifyContent: 'center' }}>
              <Ionicons name="arrow-back" size={25} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={localStyles.title}>
                {isEditing ? 'Edit Lesson' : 'Upload Lesson'}
              </Text>
              <Text style={localStyles.subtitle}>
                {isEditing ? 'Update your lesson details and PDF lesson file' : 'Publish a new lesson by uploading a PDF lesson document'}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
          <View style={[localStyles.card, { backgroundColor: theme.card }]}>
            <Text style={[localStyles.label, { color: theme.subText }]}>LESSON TITLE</Text>
              <TextInput 
                style={[localStyles.input, { backgroundColor: theme.card, color: theme.text }]} 
                placeholder="Automatically set from PDF file name if left empty"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[localStyles.label, { color: theme.subText, marginTop: 25 }]}>PDF LESSON DOCUMENT</Text>
              <TouchableOpacity 
                style={[localStyles.dropZone, { borderColor: file || editingLesson?.pdfUrl ? '#153c2a' : '#ccc', backgroundColor: theme.card }]} 
                onPress={pickDocument}
              >
                <Ionicons 
                  name={file || editingLesson?.pdfUrl ? "document-text" : "cloud-upload"} 
                  size={40} 
                  color={file || editingLesson?.pdfUrl ? "#153c2a" : "#999"} 
                />
                <Text style={[localStyles.dropText, { color: theme.text }]}>
                  {file ? file.name : (editingLesson?.pdfName || "Tap to select a PDF File")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[localStyles.uploadBtn, { opacity: loading ? 0.7 : 1 }]} 
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={localStyles.uploadBtnText}>
                      {isEditing ? 'Save Changes' : 'Publish Lesson'}
                  </Text>
                )}
              </TouchableOpacity>
          </View>
      </ScrollView>
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
  title: { fontSize: 25, fontWeight: '900', color: '#fff', marginTop: 20 },
  subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },
  card: { 
    padding: 25, 
    borderRadius: 10, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 10 
  },
  label: { fontSize: 13, fontWeight: '800', marginBottom: 8, letterSpacing: 1, marginTop: 5 },
  input: { padding: 15, borderRadius: 10, fontSize: 15, fontWeight: '600', elevation: 1, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5 },
  dropZone: { width: '100%', height: 150, borderRadius: 10, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  dropText: { fontWeight: 'bold', marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30 },
  uploadBtn: { backgroundColor: '#153c2a', height: 55, borderRadius: 10, marginTop: 40, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  uploadBtnText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1 }
});