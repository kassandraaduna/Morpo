import React, { useEffect, useState, useContext, useCallback } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  RefreshControl, StyleSheet, StatusBar, TextInput, Platform, Alert 
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import api, { toAbsUrl } from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import moment from 'moment';

export default function Learn({ navigation, route }) {
  const { theme } = useContext(ThemeContext);
  
  // 1. Initialize all arrays, including 'remedial'
  const [data, setData] = useState({ lessons: [], models: [], assessments: [], remedial: [] });
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeTab, setActiveTab] = useState(route.params?.initialTab?.toLowerCase() || 'lessons'); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [bookmarks, setBookmarks] = useState({ lessons: [], models: [] });

  const isInstructor = user?.role?.toLowerCase() === 'instructor';
  const visibleTabs = isInstructor ? ['lessons', 'models', 'assessments'] : ['lessons', 'remedial', 'models'];

  // 2. Safe Fetch Logic
  const fetchData = async () => {
    try {
      setLoading(true);
      const rawUser = await AsyncStorage.getItem('user');
      const currentUser = rawUser ? JSON.parse(rawUser) : null;
      const isInst = currentUser?.role?.toLowerCase() === 'instructor';
      setUser(currentUser);

      const [lessonRes, modelRes, assessRes] = await Promise.all([
        api.get('/lessons'),
        api.get('/models3d'),
        api.get('/assessments')
      ]);

      let remedialData = [];
      if (!isInst && currentUser?._id) {
        try {
          const remedialRes = await api.get(`/ai/personalized-lessons/${currentUser._id}`);
          remedialData = remedialRes.data?.data || [];
        } catch (e) {
          console.log("Remedial Fetch Error:", e);
          toastError("Could not load remedial lessons.");
        }
      }

      setData({
        lessons: (lessonRes.data?.data || []).filter(l => !l.is_archived),
        models: modelRes.data?.data || [],
        assessments: assessRes.data?.data || [],
        remedial: remedialData 
      });

    } catch (err) {
      toastError('Failed to load content');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadBookmarks = async () => {
    const stored = await AsyncStorage.getItem('studentBookmarks_v1');
    if (stored) setBookmarks(JSON.parse(stored));
  };

  useFocusEffect(useCallback(() => { 
    if (route.params?.initialTab) {
        setActiveTab(route.params.initialTab.toLowerCase());
    }
    fetchData(); 
    loadBookmarks();
  }, [route.params?.initialTab]));

  // 3. Safe Search Filter (checks for topic or title)
  useEffect(() => {
    const list = data[activeTab] || [];
    if (!searchQuery.trim()) {
      setFilteredData(list);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = list.filter(item => {
        const name = (item.title || item.topic || '').toLowerCase();
        return name.includes(query);
      });
      setFilteredData(filtered);
    }
  }, [searchQuery, activeTab, data]);

  const handleToggleBookmark = async (type, id) => {
    let newBookmarks = { ...bookmarks };
    if (!newBookmarks[type]) newBookmarks[type] = [];
    
    if (newBookmarks[type].includes(id)) {
      newBookmarks[type] = newBookmarks[type].filter(itemId => itemId !== id);
      toastSuccess("Removed from Bookmarks");
    } else {
      newBookmarks[type].push(id);
      toastSuccess("Saved to Bookmarks");
    }
    
    setBookmarks(newBookmarks);
    await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(newBookmarks));
  };

  const handleArchive = async (id) => {
    Alert.alert("Archive Lesson", "Move this to your archive list?", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", onPress: async () => {
          try {
            await api.put(`/lessons/${id}`, { 
              isArchived: true, 
              modifiedBy: user?._id 
            });
            toastSuccess("Moved to Archive");
            fetchData();
          } catch (e) {
            toastError("Archive failed");
          }
      }}
    ]);
  };

  const onLessonPress = async (lessonId) => {
    try {
      await api.post(`/lessons/${lessonId}/access`, { userId: user?._id });
      navigation.navigate('LessonStudent', { lessonId });
    } catch (e) {
      navigation.navigate('LessonStudent', { lessonId });
    }
  };

  const renderLessonItem = ({ item }) => {
    const actor = item.modifiedBy ? `${item.modifiedBy.fname} ${item.modifiedBy.lname}` : 'System';
    const time = moment(item.lastAccessedAt || item.updatedAt).format('MMM DD, YYYY | hh:mm A');
    const isBookmarked = bookmarks.lessons?.includes(item._id);

    return (
      <View style={[localStyles.card, { backgroundColor: theme.card }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => onLessonPress(item._id)}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[localStyles.iconBox, { backgroundColor: '#E7F5EE' }]}>
              <Ionicons name="document-text" size={22} color="#153c2a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
              <Text style={localStyles.metadataText}>Last modified by: {actor}</Text>
              <Text style={localStyles.metadataText}>on: {time}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={localStyles.actionGroup}>
          {!isInstructor && (
            <TouchableOpacity onPress={() => handleToggleBookmark('lessons', item._id)}>
              <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color={isBookmarked ? "#10b981" : "#94A3B8"} />
            </TouchableOpacity>
          )}
          {isInstructor && (
            <>
              <TouchableOpacity onPress={() => navigation.navigate('UploadLesson', { lesson: item })}>
                <Ionicons name="create" size={20} color="#153c2a" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleArchive(item._id)}>
                <Ionicons name="archive" size={20} color="#d97706" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderRemedialItem = ({ item }) => {
    return (
      <TouchableOpacity 
        style={[localStyles.card, { backgroundColor: theme.card }]}
        onPress={() => navigation.navigate('LessonStudent', { personalizedLesson: item })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[localStyles.iconBox, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="medical" size={22} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={2}>
              Remedial: {item.topic}
            </Text>
            <Text style={localStyles.metadataText}>Personalized Remedial Lesson</Text>
            <Text style={localStyles.metadataText}>Generated: {moment(item.createdAt).format('MMM DD, YYYY')}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </TouchableOpacity>
    );
  };

  const renderModelItem = ({ item }) => {
    const isBookmarked = bookmarks.models?.includes(item._id);
    return (
      <View style={[localStyles.modelCard, { backgroundColor: theme.card }]}>
        <View style={localStyles.modelThumbContainer}>
          <WebView scrollEnabled={false} source={{ html: `<html><body style="margin:0; background:#f0f4f2;"><script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script><model-viewer src="${toAbsUrl(item.fileUrl)}" auto-rotate interaction-prompt="none" style="width:100%; height:100%;"></model-viewer></body></html>` }} />
          
          <TouchableOpacity 
            style={localStyles.bookmarkFloat}
            onPress={() => handleToggleBookmark('models', item._id)}
          >
            <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={20} color={isBookmarked ? "#10b981" : "#153c2a"} />
          </TouchableOpacity>
        </View>
        <View style={localStyles.modelInfo}>
          <Text style={[localStyles.cardTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={localStyles.metadataText} numberOfLines={2}>{item.description || "No description provided."}</Text>
          <TouchableOpacity style={localStyles.viewBtn} onPress={() => navigation.navigate('ModelViewerMobile', { modelId: item._id, modelTitle: item.title, modelUrl: item.fileUrl, labels: item.labels })}>
            <Text style={localStyles.viewBtnText}>VIEW 3D MODEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAssessmentItem = ({ item }) => {
    const qCount = item.questions?.length || 0;
    const timerText = item.timer?.enabled ? `${item.timer.minutes}m Timer` : 'No Timer';
    const deadline = item.deadlineAt ? moment(item.deadlineAt).format('MMM DD, hh:mm A') : 'No Deadline';

    return (
      <TouchableOpacity 
        style={[localStyles.card, { backgroundColor: theme.card }]}
        onPress={() => isInstructor 
          ? navigation.navigate('AssessmentQuestionsView', { assessment: item }) 
          : navigation.navigate('TakeAssessment', { assessmentId: item._id })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[localStyles.iconBox, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="clipboard" size={22} color="#4338ca" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[localStyles.cardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
            <Text style={localStyles.metadataText}>{qCount} Questions • {timerText}</Text>
            <Text style={localStyles.metadataText}>Deadline: {deadline}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </TouchableOpacity>
    );
  };

  // 4. Guaranteed Safe Rendering
  const renderContentItem = ({ item }) => {
    if (activeTab === 'remedial') return renderRemedialItem({ item });
    if (activeTab === 'models') return renderModelItem({ item });
    if (activeTab === 'assessments') return renderAssessmentItem({ item });
    return renderLessonItem({ item });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      <View style={localStyles.headerColored}>
        <View style={localStyles.headerRow}>
          <Text style={localStyles.headerTitle}>Learning Materials</Text>
          {isInstructor && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={localStyles.archiveHeaderBtn} onPress={() => navigation.navigate('UploadLesson')}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={localStyles.archiveHeaderBtn} onPress={() => navigation.navigate('ArchiveLessons')}>
                <Ionicons name="archive" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={localStyles.searchContainer}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput 
            placeholder={`Search ${activeTab}...`}
            style={localStyles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <View style={localStyles.tabWrapper}>
        {visibleTabs.map((tab) => (
          <TouchableOpacity key={tab} style={[localStyles.tabItem, activeTab === tab && localStyles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[localStyles.tabLabel, { color: activeTab === tab ? '#153c2a' : '#64748B' }]}>
              {tab === 'models' ? '3D MODELS' : tab === 'remedial' ? 'REMEDIAL' : tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#153c2a" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item._id}
          renderItem={renderContentItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor="#153c2a" />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="folder-open-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>No {activeTab} found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  headerColored: { backgroundColor: '#153c2a', paddingTop: 60, paddingBottom: 25, paddingHorizontal: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff' },
  archiveHeaderBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  searchContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 15, paddingHorizontal: 15, height: 45, alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600' },
  tabWrapper: { flexDirection: 'row', marginHorizontal: 22, marginTop: 20, marginBottom: 10, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabLabel: { fontSize: 10, fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 12, elevation: 3 },
  iconBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  metadataText: { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modelCard: { borderRadius: 25, marginBottom: 20, overflow: 'hidden', elevation: 4 },
  modelThumbContainer: { height: 180, position: 'relative' },
  modelInfo: { padding: 20 },
  viewBtn: { marginTop: 15, backgroundColor: '#153c2a', paddingVertical: 12, borderRadius: 15, alignItems: 'center' },
  viewBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  bookmarkFloat: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 20, zIndex: 10 },
});