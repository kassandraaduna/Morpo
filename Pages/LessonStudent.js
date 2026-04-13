import React, { useEffect, useState, useContext } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Pdf from 'react-native-pdf';
import api from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import styles from './src/styles/Styles';
import { toastError } from './src/components/ToastMsg';

const SERVER_URL = 'http://192.168.1.24:8000';

export default function LessonStudent({ route, navigation }) {
  const { lessonId, personalizedLesson } = route.params || {};
  const { theme } = useContext(ThemeContext);
  
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  const [localPdfPath, setLocalPdfPath] = useState(null);
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    const checkBookmark = async () => {
      if (!lessonId) return;
      const stored = await AsyncStorage.getItem('studentBookmarks_v1');
      if (stored) {
         const parsed = JSON.parse(stored);
         if (parsed.lessons?.includes(lessonId)) setIsBookmarked(true);
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
    if (!lessonId) return;
    const stored = await AsyncStorage.getItem('studentBookmarks_v1');
    let parsed = stored ? JSON.parse(stored) : { lessons: [], models: [] };
    if (!parsed.lessons) parsed.lessons = [];
    
    if (parsed.lessons.includes(lessonId)) {
        parsed.lessons = parsed.lessons.filter(id => id !== lessonId);
        setIsBookmarked(false);
    } else {
        parsed.lessons.push(lessonId);
        setIsBookmarked(true);
    }
    await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(parsed));
  };

  const getCleanUrl = (partialPath) => {
    if (!partialPath) return '';
    let cleanPath = partialPath.trim(); 
    if (cleanPath.startsWith('http')) return cleanPath;
    
    const baseUrl = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
    cleanPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    return `${baseUrl}${cleanPath}`;
  };

  const securelyFetchPdf = async (partialUrl) => {
    try {
      const finalUrl = getCleanUrl(partialUrl);
      const safeUrl = encodeURI(finalUrl);
      
      console.log("Fetching PDF from:", safeUrl); // Debug log

      const fileName = `safe_view_${Date.now()}.pdf`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      const downloadRes = await FileSystem.downloadAsync(safeUrl, fileUri);
      
      if (downloadRes.status === 200) {
        // FIX 2: Check if the server actually sent us a PDF or just an HTML error page
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
      console.log('Network error:', error);
      setPdfError('Network connection failed while downloading document.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdfOffline = async () => {
    if (!lesson?.pdfUrl) return toastError('Invalid PDF URL');
    try {
      setDownloading(true);
      const finalUrl = getCleanUrl(lesson.pdfUrl);
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
      console.log(err);
      toastError('Failed to download PDF.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.subText, marginTop: 10 }}>Fetching Document...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.subText + '33' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, flex: 1 }} numberOfLines={1}>
          {lesson?.title || 'Lesson Details'}
        </Text>
        
        {!personalizedLesson && (
          <TouchableOpacity onPress={toggleBookmark} style={{ paddingHorizontal: 10 }}>
            <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={24} color={theme.primary} />
          </TouchableOpacity>
        )}

        {lesson?.pdfUrl && !pdfError && (
          <TouchableOpacity onPress={downloadPdfOffline} disabled={downloading} style={{ paddingLeft: 10 }}>
            {downloading ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <Ionicons name="download-outline" size={24} color={theme.text} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {lesson?.educationalContent ? (
        <View style={{ padding: 16, backgroundColor: theme.card, marginHorizontal: 16, borderRadius: 12, marginTop: 16, marginBottom: 10 }}>
          <Text style={{ color: theme.text, fontSize: 14, lineHeight: 22 }}>
            {lesson.educationalContent}
          </Text>
        </View>
      ) : null}

      {pdfError ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="alert-circle-outline" size={50} color="#ef4444" style={{ marginBottom: 10 }} />
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>
            Document Unavailable
          </Text>
          <Text style={{ color: theme.subText, textAlign: 'center' }}>
            {pdfError}
          </Text>
          <Text style={{ color: theme.subText, textAlign: 'center', marginTop: 10, fontSize: 12 }}>
            Please verify that this lesson has a valid PDF file assigned to it on the server.
          </Text>
        </View>
      ) : localPdfPath ? (
        <View style={localStyles.pdfContainer}>
          <Pdf
            /* FIX 1: Removed toAbsUrl(). Using the raw local file:// path */
            source={{ uri: localPdfPath, cache: true }}
            trustAllCerts={false} 
            onLoadComplete={(numberOfPages) => {
              console.log(`Successfully loaded PDF with ${numberOfPages} pages`);
            }}
            onError={(error) => {
              console.log('PDF Render Error:', error);
            }}
            style={localStyles.pdfView}
          />
        </View>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="document-text-outline" size={48} color={theme.subText} style={{ marginBottom: 10 }} />
          <Text style={{ color: theme.subText, textAlign: 'center' }}>
            No PDF document assigned to this lesson.
          </Text>
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  pdfContainer: {
    flex: 1,
    width: Dimensions.get('window').width,
    backgroundColor: '#E5E5E5',
  },
  pdfView: {
    flex: 1,
    width: Dimensions.get('window').width,
  }
});