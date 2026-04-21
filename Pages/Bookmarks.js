import React, { useState, useContext, useCallback, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  RefreshControl, StyleSheet, StatusBar, Platform, Image, Alert, TextInput 
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

const SERVER_URL = 'http://192.168.1.24:8000';

export default function Bookmarks({ navigation, route }) {
  const { theme } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState(route.params?.initialTab?.toLowerCase() || 'lessons'); 
  const [data, setData] = useState({ lessons: [], models: [], scans: [] });
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  
  const [bookmarksData, setBookmarksData] = useState({ lessons: [], models: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookmarks = async () => {
    try {
      const userRaw = await AsyncStorage.getItem('user');
      const currentUser = userRaw ? JSON.parse(userRaw) : null;
      setUser(currentUser);

      const stored = await AsyncStorage.getItem('studentBookmarks_v1');
      const parsedBookmarks = stored ? JSON.parse(stored) : { lessons: [], models: [] };
      setBookmarksData(parsedBookmarks);

      const requests = [
        api.get('/lessons'),
        api.get('/models3d')
      ];
      
      if (currentUser?._id) {
        requests.push(api.get(`/scan/history/${currentUser._id}`));
      }

      const results = await Promise.all(requests);

      const allLessons = results[0].data?.data || [];
      const allModels = results[1].data?.data || [];
      const allScans = results[2]?.data?.data || [];

      const fetched = {
        lessons: allLessons.filter(l => parsedBookmarks.lessons?.includes(l._id)),
        models: allModels.filter(m => parsedBookmarks.models?.includes(m._id)),
        scans: allScans.filter(s => s.bookmarked === true)
      };

      setData(fetched);
    } catch (err) {
      console.error(err);
      toastError('Failed to load bookmarks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { 
    setLoading(true);
    fetchBookmarks(); 
  }, []));

  useFocusEffect(useCallback(() => { fetchBookmarks(); }, []));

  const fetchData = async () => {
    try {
      const [lessonRes, modelRes, scanRes] = await Promise.all([
        api.get('/lessons'),
        api.get('/models3d'),
        api.get('/scan/history/' + user._id)
      ]);
      const fetched = {
        lessons: (lessonRes.data?.data || []).filter(l => !l.is_archived),
        models: modelRes.data?.data || [],
        scans: scanRes.data?.data || []
      };
      setData(fetched);
    } catch (err) {
      toastError('Failed to load content');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const list = data[activeTab] || [];
    if (!searchQuery.trim()) {
      setFilteredData(list);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = list.filter(item => {
        const itemName = (item.title || item.classification || '').toLowerCase();
        return itemName.includes(query);
      });
      setFilteredData(filtered);
    }
  }, [searchQuery, activeTab, data]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookmarks();
  };

  const removeBookmarkLocal = async (type, id) => {
    let newBookmarks = { ...bookmarksData };
    if (newBookmarks[type]) {
      newBookmarks[type] = newBookmarks[type].filter(item => item !== id);
    }
    setBookmarksData(newBookmarks);
    await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(newBookmarks));

    if (type === 'lessons') {
      setBookmarkedLessons(prev => prev.filter(l => l._id !== id));
    } else if (type === 'models') {
      setBookmarkedModels(prev => prev.filter(m => m._id !== id));
    }
  };

  const toggleScanBookmark = async (id) => {
    try {
      await api.put(`/scan-bookmark/${id}`);
      setBookmarkedScans(prev => prev.filter(s => s._id !== id));
      toastSuccess("Removed from Bookmarks");
    } catch (e) {
      toastError("Failed to update scan bookmark");
    }
  };

  const deleteScanHistoryItem = (id) => {
    Alert.alert(
      "Hide Scan", 
      "Remove this scan from your history? This action cannot be undone.", 
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            try {
              await api.delete(`/scan/history/item/${id}?studentId=${user._id}`);
              setBookmarkedScans(prev => prev.filter(s => s._id !== id));
              toastSuccess("Scan removed");
            } catch (e) {
              toastError("Failed to remove scan");
            }
          }
        }
      ]
    );
  };

  const getCleanUrl = (path) => {
    if (!path) return '';
    let clean = path.trim();
    if (clean.startsWith('http')) return clean;
    const base = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
    return `${base}${clean.startsWith('/') ? clean : '/' + clean}`;
  };

  const renderLessonItem = ({ item }) => (
    <TouchableOpacity 
      style={[localStyles.cardWrapper, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('LessonStudent', { lessonId: item._id })}
    >
      <View style={[localStyles.iconBox, { backgroundColor: '#2d6a4f' + '15' }]}>
        <Ionicons name="document-text" size={24} color="#2d6a4f" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: theme.subText, fontSize: 12 }}>{item.pdfName || "PDF Document"}</Text>
      </View>
      <TouchableOpacity style={{ padding: 8 }} onPress={() => removeBookmarkLocal('lessons', item._id)}>
        <Ionicons name="bookmark" size={22} color="#10b981" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderScanItem = ({ item }) => {
    const d = new Date(item.createdAt);
    const timeString = d.toLocaleDateString();
    return (
      <View style={[localStyles.cardWrapper, { backgroundColor: theme.card }]}>
        <Image source={{ uri: getCleanUrl(item.imageUrl) }} style={localStyles.scanThumb} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[localStyles.cardTitle, { color: theme.text }]}>{item.classification}</Text>
          <Text style={{ color: theme.subText, fontSize: 12 }}>{Number(item.confidence).toFixed(1)}% Confidence Score• {timeString}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => toggleScanBookmark(item._id)}>
            <Ionicons name="bookmark" size={22} color="#10b981" />
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 8 }} onPress={() => deleteScanHistoryItem(item._id)}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderModelItem = ({ item }) => {
    const finalUrl = getCleanUrl(item.fileUrl);
    const thumbHtml = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
          <style>body { margin: 0; background-color: #f0f4f2; display: flex; justify-content: center; } model-viewer { width: 100vw; height: 100vh; --poster-color: transparent; }</style>
        </head>
        <body><model-viewer src="${finalUrl}" auto-rotate rotation-per-second="30deg" interaction-prompt="none" shadow-intensity="1"></model-viewer></body>
      </html>
    `;

    return (
      <View style={[localStyles.modelCard, { backgroundColor: theme.card }]}>
        <View style={localStyles.modelThumbContainer}>
          <WebView scrollEnabled={false} source={{ html: thumbHtml }} style={{ backgroundColor: '#f0f4f2' }} />
          <TouchableOpacity style={localStyles.bookmarkFloat} onPress={() => removeBookmarkLocal('models', item._id)}>
            <Ionicons name="bookmark" size={20} color="#10b981" />
          </TouchableOpacity>
        </View>
        <View style={localStyles.modelInfo}>
          <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={{ color: '#6b6b6b', fontSize: 12, fontWeight: '400', marginTop: 5 }}>{item.description}</Text>
          <TouchableOpacity 
            style={[localStyles.viewBtn, { backgroundColor: '#153c2a' }]}
            onPress={() => navigation.navigate('ModelViewerMobile', { modelId: item._id, modelTitle: item.title, modelUrl: item.fileUrl, labels: item.labels })}
          >
            <Text style={localStyles.viewBtnText}>VIEW 3D MODEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getCurrentData = () => {
    if (activeTab === 'lessons') return bookmarkedLessons;
    if (activeTab === 'models') return bookmarkedModels;
    return bookmarkedScans;
  };

  const getCurrentRender = () => {
    if (activeTab === 'lessons') return renderLessonItem;
    if (activeTab === 'models') return renderModelItem;
    return renderScanItem;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      
      <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
        <View style={localStyles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={localStyles.headerTitle}>Bookmarks</Text>
        </View>

        <View style={localStyles.searchContainer}>
                  <Ionicons name="search" size={18} color="#94A3B8" />
                  <TextInput 
                    placeholder={`Search ${activeTab}...`}
                    style={localStyles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#94A3B8"
                  />
        </View>
      </View>

      <View style={localStyles.tabWrapper}>
        {['lessons', 'models', 'scans'].map((tab) => (
          <TouchableOpacity key={tab} style={[localStyles.tabItem, activeTab === tab && localStyles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[localStyles.tabLabel, { color: activeTab === tab ? '#153c2a' : '#64748B' }]}>
              {tab === 'models' ? '3D MODELS' : tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'scans' && (
        <View style={localStyles.disclaimerBox}>
          <Ionicons name="information-circle" size={18} color="#059669" />
          <Text style={localStyles.disclaimerText}>
            Bookmarked scans are kept safe. Non-bookmarked scans are automatically archived after 30 days.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#153c2a" /></View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item._id}
          renderItem={activeTab === 'lessons' ? renderLessonItem : (activeTab === 'models' ? renderModelItem : renderScanItem)}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor="#153c2a" />}
          ListEmptyComponent={
            <View style={localStyles.emptyState}>
              <Ionicons name="bookmark-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>No Bookmarks Yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff' },
  searchContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 15, paddingHorizontal: 15, height: 45, alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600' },
  tabWrapper: { flexDirection: 'row', marginHorizontal: 22, marginTop: 20, marginBottom: 10, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabLabel: { fontSize: 10, fontWeight: '800' },
  listPadding: { padding: 20, paddingBottom: 100 },
  
  disclaimerBox: { marginHorizontal: 20, marginTop: 15, padding: 12, backgroundColor: '#ecfdf5', borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderColor: '#d1fae5', borderWidth: 1 },
  disclaimerText: { color: '#065f46', fontSize: 12, fontWeight: '600', marginLeft: 8, flex: 1 },

  cardWrapper: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  iconBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  scanThumb: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#eee' },

  modelCard: { borderRadius: 20, marginBottom: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  modelThumbContainer: { height: 200, backgroundColor: '#f0f4f2', position: 'relative' },
  modelInfo: { padding: 16 },
  viewBtn: { marginTop: 15, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  viewBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  bookmarkFloat: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 20, zIndex: 10 },
  
  emptyState: { alignItems: 'center', marginTop: 80 }
});