import React, { useState, useContext, useCallback } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  RefreshControl, StyleSheet, StatusBar, Dimensions, Platform 
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError } from './src/components/ToastMsg';

const { width } = Dimensions.get('window');
const SERVER_URL = 'http://192.168.1.24:8000';

export default function Bookmarks({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState('lessons'); 
  const [bookmarkedLessons, setBookmarkedLessons] = useState([]);
  const [bookmarkedModels, setBookmarkedModels] = useState([]);
  const [bookmarksData, setBookmarksData] = useState({ lessons: [], models: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookmarks = async () => {
    try {
      // 1. Get IDs from local storage
      const stored = await AsyncStorage.getItem('studentBookmarks_v1');
      const parsedBookmarks = stored ? JSON.parse(stored) : { lessons: [], models: [] };
      setBookmarksData(parsedBookmarks);

      // 2. Fetch all content from backend
      const [lessonRes, modelRes] = await Promise.all([
        api.get('/lessons'),
        api.get('/models3d')
      ]);

      const allLessons = lessonRes.data?.data || [];
      const allModels = modelRes.data?.data || [];

      // 3. Filter only bookmarked items
      const filteredLessons = allLessons.filter(l => parsedBookmarks.lessons?.includes(l._id));
      const filteredModels = allModels.filter(m => parsedBookmarks.models?.includes(m._id));

      setBookmarkedLessons(filteredLessons);
      setBookmarkedModels(filteredModels);
    } catch (err) {
      toastError('Failed to load bookmarks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBookmarks();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookmarks();
  };

  const removeBookmark = async (type, id) => {
    let newBookmarks = { ...bookmarksData };
    if (newBookmarks[type]) {
      newBookmarks[type] = newBookmarks[type].filter(item => item !== id);
    }
    
    setBookmarksData(newBookmarks);
    await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(newBookmarks));

    // Update UI instantly
    if (type === 'lessons') {
      setBookmarkedLessons(prev => prev.filter(l => l._id !== id));
    } else {
      setBookmarkedModels(prev => prev.filter(m => m._id !== id));
    }
  };

  const getCleanUrl = (path) => {
    if (!path) return '';
    let clean = path.trim();
    if (clean.startsWith('http')) return clean;
    const base = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
    return `${base}${clean.startsWith('/') ? clean : '/' + clean}`;
  };

  // --- RENDER LESSONS ---
  const renderLessonItem = ({ item }) => (
    <TouchableOpacity 
      style={[localStyles.lessonCard, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('LessonStudent', { lessonId: item._id })}
    >
      <View style={[localStyles.iconBox, { backgroundColor: theme.primary + '15' }]}>
        <Ionicons name="document-text" size={24} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: theme.subText, fontSize: 12 }}>{item.pdfName || "PDF Document"}</Text>
      </View>
      
      <TouchableOpacity 
        style={{ padding: 8, marginRight: 5 }} 
        onPress={(e) => { e.stopPropagation(); removeBookmark('lessons', item._id); }}
      >
        <Ionicons name="bookmark" size={22} color={theme.primary} />
      </TouchableOpacity>

      <Ionicons name="chevron-forward" size={18} color={theme.subText} />
    </TouchableOpacity>
  );

  // --- RENDER 3D MODELS ---
  const renderModelItem = ({ item }) => {
    const finalUrl = getCleanUrl(item.fileUrl);
    
    const thumbHtml = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
          <style>
            body { margin: 0; background-color: #f0f4f2; display: flex; justify-content: center; }
            model-viewer { width: 100vw; height: 100vh; --poster-color: transparent; }
          </style>
        </head>
        <body>
          <model-viewer src="${finalUrl}" auto-rotate rotation-per-second="30deg" interaction-prompt="none" shadow-intensity="1"></model-viewer>
        </body>
      </html>
    `;

    return (
      <View style={[localStyles.modelCard, { backgroundColor: theme.card }]}>
        <View style={localStyles.modelThumbContainer}>
          <WebView
            scrollEnabled={false}
            source={{ html: thumbHtml }}
            style={{ backgroundColor: '#f0f4f2' }}
          />
          <TouchableOpacity 
            style={localStyles.bookmarkFloat}
            onPress={() => removeBookmark('models', item._id)}
          >
            <Ionicons name="bookmark" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <View style={localStyles.modelInfo}>
          <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[localStyles.modelDesc, { color: theme.subText }]} numberOfLines={2}>
            {item.description || "Explore this 3D structure by clicking and dragging."}
          </Text>
          <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '800', marginTop: 5 }}>{item.fileName}</Text>
          
          <TouchableOpacity 
            style={[localStyles.viewBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('ModelViewerMobile', { modelId: item._id, modelTitle: item.title, modelUrl: item.fileUrl, labels: item.labels })}
          >
            <Text style={localStyles.viewBtnText}>View Full Screen</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      
      <View style={localStyles.header}>
        <View style={localStyles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={28} color={theme.text} />
          </TouchableOpacity>
          <Text style={[localStyles.headerTitle, { color: theme.text }]}>Bookmarks</Text>
        </View>

        <View style={[localStyles.tabBar, { backgroundColor: theme.mode === 'dark' ? '#1a1a1a' : '#f0f0f0' }]}>
          <TouchableOpacity 
            style={[localStyles.tab, activeTab === 'lessons' && { backgroundColor: theme.card, elevation: 3 }]}
            onPress={() => setActiveTab('lessons')}
          >
            <Text style={[localStyles.tabText, { color: activeTab === 'lessons' ? theme.primary : theme.subText }]}>Lessons</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[localStyles.tab, activeTab === 'models' && { backgroundColor: theme.card, elevation: 3 }]}
            onPress={() => setActiveTab('models')}
          >
            <Text style={[localStyles.tabText, { color: activeTab === 'models' ? theme.primary : theme.subText }]}>3D Models</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <FlatList
          data={activeTab === 'lessons' ? bookmarkedLessons : bookmarkedModels}
          keyExtractor={(item) => item._id}
          renderItem={activeTab === 'lessons' ? renderLessonItem : renderModelItem}
          contentContainerStyle={localStyles.listPadding}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={localStyles.emptyState}>
              <Ionicons name="bookmark-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>No Bookmarks Yet</Text>
              <Text style={{ color: theme.subText, textAlign: 'center', marginTop: 5, paddingHorizontal: 40 }}>
                Items you bookmark in the Educational tab will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: '900' },
  tabBar: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: 'bold' },
  listPadding: { padding: 20, paddingBottom: 100 },
  
  lessonCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 2 },
  iconBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },

  modelCard: { borderRadius: 20, marginBottom: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  modelThumbContainer: { height: 200, backgroundColor: '#f0f4f2', position: 'relative' },
  modelInfo: { padding: 16 },
  modelDesc: { fontSize: 13, marginTop: 5, lineHeight: 18 },
  viewBtn: { marginTop: 15, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  viewBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  bookmarkFloat: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.85)', padding: 8, borderRadius: 20, zIndex: 10 },
  
  emptyState: { alignItems: 'center', marginTop: 80 }
});