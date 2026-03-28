import React, { useEffect, useState, useContext } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  StyleSheet, 
  StatusBar,
  Dimensions,
  Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import styles from './src/styles/Styles'; 
import { toastError } from './src/components/ToastMsg';

const { width } = Dimensions.get('window');
const SERVER_URL = 'http://192.168.1.24:8000';

export default function Learn({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState('lessons'); 
  const [lessons, setLessons] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [lessonRes, modelRes] = await Promise.all([
        api.get('/lessons'),
        api.get('/models3d')
      ]);
      setLessons(lessonRes.data?.data || []);
      setModels(modelRes.data?.data || []);
    } catch (err) {
      toastError('Failed to load educational content');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getCleanUrl = (path) => {
    if (!path) return '';
    let clean = path.trim();
    if (clean.startsWith('http')) return clean;
    const base = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
    return `${base}${clean.startsWith('/') ? clean : '/' + clean}`;
  };

  // --- RENDER LESSONS (Row Style) ---
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
      <Ionicons name="chevron-forward" size={18} color={theme.subText} />
    </TouchableOpacity>
  );

  // --- RENDER 3D MODELS (Web-Style Thumbnail Card) ---
  const renderModelItem = ({ item }) => {
    const finalUrl = getCleanUrl(item.fileUrl);
    
    // Injecting the same model-viewer used in your web app into the card
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
        {/* Interactive Thumbnail Area */}
        <View style={localStyles.modelThumbContainer}>
          <WebView
            scrollEnabled={false}
            source={{ html: thumbHtml }}
            style={{ backgroundColor: '#f0f4f2' }}
          />
        </View>

        {/* Info Area */}
        <View style={localStyles.modelInfo}>
          <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[localStyles.modelDesc, { color: theme.subText }]} numberOfLines={2}>
            {item.description || "Explore this 3D structure by clicking and dragging."}
          </Text>
          <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '800', marginTop: 5 }}>{item.fileName}</Text>
          
          <TouchableOpacity 
            style={[localStyles.viewBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('ModelViewerMobile', { modelTitle: item.title, modelUrl: item.fileUrl })}
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
        <Text style={[localStyles.headerTitle, { color: theme.text }]}>Educational</Text>
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
          data={activeTab === 'lessons' ? lessons : models}
          keyExtractor={(item) => item._id}
          renderItem={activeTab === 'lessons' ? renderLessonItem : renderModelItem}
          contentContainerStyle={localStyles.listPadding}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={localStyles.emptyState}>
              <Ionicons name="search-outline" size={50} color={theme.subText + '44'} />
              <Text style={{ color: theme.subText }}>Nothing found here yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 15 },
  headerTitle: { fontSize: 28, fontWeight: '900', marginBottom: 15 },
  tabBar: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: 'bold' },
  listPadding: { padding: 20, paddingBottom: 100 },
  
  lessonCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 2 },
  iconBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },

  modelCard: { borderRadius: 20, marginBottom: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  modelThumbContainer: { height: 200, backgroundColor: '#f0f4f2' },
  modelInfo: { padding: 16 },
  modelDesc: { fontSize: 13, marginTop: 5, lineHeight: 18 },
  viewBtn: { marginTop: 15, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  viewBtnText: { color: '#153c2a', fontWeight: 'bold', fontSize: 14 },
  
  emptyState: { alignItems: 'center', marginTop: 100 }
});