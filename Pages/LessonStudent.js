import React, { useEffect, useState, useContext } from 'react';
import { 
    View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, 
    Dimensions, ScrollView, Platform, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Pdf from 'react-native-pdf';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

export default function LessonStudent({ route, navigation }) {
  const { lessonId, personalizedLesson } = route.params || {};
  const { theme } = useContext(ThemeContext);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  
  const [remedialAssessmentId, setRemedialAssessmentId] = useState(personalizedLesson?.remedialAssessmentId || null);
  
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  const [localPdfPath, setLocalPdfPath] = useState(null);
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('user').then(u => {
        if(u) setCurrentUser(JSON.parse(u));
    });

    const checkBookmark = async () => {
      const targetId = lessonId || personalizedLesson?._id;
      if (!targetId) return;

      const stored = await AsyncStorage.getItem('studentBookmarks_v1');
      if (stored) {
         const parsed = JSON.parse(stored);
         if (parsed.lessons?.includes(targetId)) setIsBookmarked(true);
      }
    };
    checkBookmark();

    if (personalizedLesson) {
      const parts = String(personalizedLesson.content || '').split('|||PDF_URL|||');
      const data = {
        title: `Remedial: ${personalizedLesson.topic}`,
        pdfUrl: parts[1] || '',
        educationalContent: parts[0],
      };
      setLesson(data);
      if (data.pdfUrl) {
        securelyFetchPdf(data.pdfUrl);
      } else {
        setLoading(false);
      }
      return;
    }

    const fetchLesson = async () => {
      try {
        const res = await api.get(`/lessons/${lessonId}`);
        const data = res.data?.data || res.data;
        setLesson(data);
        
        if (data?.pdfUrl) {
          await securelyFetchPdf(data.pdfUrl);
        } else {
          setLoading(false);
        }
      } catch (e) {
        toastError('Failed to load lesson data');
        navigation.goBack();
      }
    };

    fetchLesson();
  }, [lessonId, personalizedLesson]);

  const toggleBookmark = async () => {
    const targetId = lessonId || personalizedLesson?._id;
    if (!targetId) return;

    const stored = await AsyncStorage.getItem('studentBookmarks_v1');
    let parsed = stored ? JSON.parse(stored) : { lessons: [], models: [] };
    if (!parsed.lessons) parsed.lessons = [];
    
    if (parsed.lessons.includes(targetId)) {
        parsed.lessons = parsed.lessons.filter(id => id !== targetId);
        setIsBookmarked(false);
        toastSuccess("Removed from Bookmarks");
    } else {
        parsed.lessons.push(targetId);
        setIsBookmarked(true);
        toastSuccess("Saved to Bookmarks");
    }
    await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(parsed));
  };

  const securelyFetchPdf = async (partialUrl) => {
    try {
      const finalUrl = toAbsUrl(partialUrl);
      const safeUrl = encodeURI(finalUrl);
      
      const fileName = `safe_view_${Date.now()}.pdf`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      const downloadRes = await FileSystem.downloadAsync(safeUrl, fileUri);
      
      if (downloadRes.status === 200) {
        const contentType = downloadRes.headers['Content-Type'] || downloadRes.headers['content-type'] || '';
        
        if (contentType.includes('text/html')) {
          setPdfError('The server returned a web page instead of a PDF document.');
        } else {
          setLocalPdfPath(downloadRes.uri);
        }
      } else {
        setPdfError(`File missing from server (HTTP ${downloadRes.status})`);
      }
    } catch (error) {
      setPdfError('Network connection failed while downloading document.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdfOffline = async () => {
    if (!lesson?.pdfUrl) return toastError('Invalid PDF URL');
    try {
      setDownloading(true);
      const finalUrl = toAbsUrl(lesson.pdfUrl);
      const safeUrl = encodeURI(finalUrl);
      
      const fileName = lesson?.pdfName || `Lesson_${Date.now()}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName.replace(/\s+/g, '_')}`;
      
      const { uri } = await FileSystem.downloadAsync(safeUrl, fileUri);
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        toastError('Sharing not available on this device.');
      }
    } catch (err) {
      toastError('Failed to download PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRemedialAction = async () => {
      if (!personalizedLesson) return;

      if (remedialAssessmentId) {
          navigation.navigate('TakeAssessment', { assessmentId: remedialAssessmentId });
          return;
      }

      try {
          setGeneratingQuiz(true);
          
          // Ensure we extract ONLY the text content, removing the hidden PDF URL marker
          const cleanContent = String(personalizedLesson.content || '').split('|||PDF_URL|||')[0];

          const res = await api.post('/ai/generate-remedial', {
              studentId: currentUser._id,
              topic: personalizedLesson.topic,
              lessonContent: cleanContent,
              personalizedLessonId: personalizedLesson._id,
              failedQuestions: personalizedLesson.failedQuestions || [],
              questionCount: 5,
              sourceAssessmentId: personalizedLesson.sourceAssessmentId
          });
          
          toastSuccess("Remedial Assessment Generated!");
          setRemedialAssessmentId(res.data.assessmentId);
          navigation.navigate('TakeAssessment', { assessmentId: res.data.assessmentId });
      } catch (err) {
          toastError(err.response?.data?.message || "Failed to generate assessment. MyphoAI might be busy.");
      } finally {
          setGeneratingQuiz(false);
      }
  };

  if (loading) {
    return (
      <View style={[localStyles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#153c2a" />
        <Text style={{ color: theme.subText, marginTop: 10, fontWeight: '600' }}>Fetching Document...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      
      <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
        <View style={localStyles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={localStyles.title} numberOfLines={2}>
              {lesson?.title || 'Lesson Details'}
            </Text>
            <Text style={localStyles.subtitle}>
              {personalizedLesson ? 'Personalized Remedial Module' : 'Learning Module'}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={toggleBookmark} style={localStyles.iconBtn}>
              <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color="#fff" />
            </TouchableOpacity>

            {lesson?.pdfUrl && !pdfError && (
              <TouchableOpacity onPress={downloadPdfOffline} disabled={downloading} style={localStyles.iconBtn}>
                {downloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="download-outline" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {lesson?.educationalContent && (!personalizedLesson || pdfError) ? (
          <ScrollView 
            style={[localStyles.textContent, { backgroundColor: theme.card, maxHeight: localPdfPath ? 240 : undefined }]}
            nestedScrollEnabled={true}
          >
            <Text style={{ color: theme.text, fontSize: 14, lineHeight: 24 }}>
              {lesson.educationalContent}
            </Text>
          </ScrollView>
        ) : null}

        {pdfError ? (
          <View style={[localStyles.center, { padding: 20 }]}>
            <Ionicons name="alert-circle-outline" size={50} color="#ef4444" style={{ marginBottom: 10 }} />
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>Document Unavailable</Text>
            <Text style={{ color: theme.subText, textAlign: 'center' }}>{pdfError}</Text>
          </View>
        ) : localPdfPath ? (
          <View style={localStyles.pdfContainer}>
            <Pdf
              source={{ uri: localPdfPath, cache: true }}
              trustAllCerts={false} 
              style={localStyles.pdfView}
            />
          </View>
        ) : (
          <View style={[localStyles.center, { padding: 20 }]}>
            <Ionicons name="document-text-outline" size={48} color={theme.subText} style={{ marginBottom: 10 }} />
            <Text style={{ color: theme.subText, textAlign: 'center' }}>No PDF document assigned to this lesson.</Text>
          </View>
        )}
      </View>

      {!!personalizedLesson?._id && (
        <View style={[localStyles.footer, { backgroundColor: theme.card }]}>
            <TouchableOpacity 
                style={[localStyles.submitBtn, generatingQuiz && { opacity: 0.7 }]}
                onPress={handleRemedialAction}
                disabled={generatingQuiz}
            >
                {generatingQuiz ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={localStyles.submitBtnText}>
                        {remedialAssessmentId ? 'Take Remedial Assessment' : 'Generate Remedial Assessment'}
                    </Text>
                )}
            </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 25, 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30 
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 10 },
  subtitle: { fontSize: 13, color: '#d1fae5', marginTop: 2 },
  iconBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12, marginTop: 10 },

  textContent: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8
  },

  pdfContainer: {
    flex: 1,
    width: Dimensions.get('window').width,
    backgroundColor: '#E5E5E5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden'
  },
  pdfView: {
    flex: 1,
    width: Dimensions.get('window').width,
  },

  footer: { 
    padding: 20, 
    borderTopWidth: 1, 
    borderColor: '#eee',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10
  },
  submitBtn: { 
    backgroundColor: '#153c2a', 
    padding: 18, 
    borderRadius: 16, 
    alignItems: 'center' 
  },
  submitBtnText: { 
    color: '#fff', 
    fontWeight: '900', 
    fontSize: 15,
    letterSpacing: 0.5 
  }
});