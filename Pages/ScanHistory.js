import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, 
  StyleSheet, Platform, StatusBar, Alert, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './src/services/api'; 
import { ThemeContext } from './src/context/ThemeContext';
import { toastError, toastSuccess } from './src/components/ToastMsg';

const SERVER_URL = 'http://192.168.1.24:8000';

export default function ScanHistory({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All'); // 'All', 'Yeast', 'Mold'

  useEffect(() => {
    const init = async () => {
      const userRaw = await AsyncStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        setUser(u);
        fetchHistory(u._id);
      }
    };
    init();
  }, []);

  const fetchHistory = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/scan/history/${id}`);
      const data = res.data.data || [];
      setHistory(data);
      setFilteredHistory(data);
    } catch (err) {
      toastError("Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  // Filter Logic
  useEffect(() => {
    if (activeFilter === 'All') {
      setFilteredHistory(history);
    } else {
      setFilteredHistory(history.filter(item => 
        item.classification?.toLowerCase().includes(activeFilter.toLowerCase())
      ));
    }
  }, [activeFilter, history]);

  const handleClearAll = () => {
    if (history.length === 0) return toastError("History is already empty.");

    Alert.alert(
      "Clear All History", 
      "Are you sure you want to delete all your scan history? This action cannot be undone.", 
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive", 
          onPress: async () => {
            setLoading(true);
            try {
              // Loops through and deletes all items using your existing route
              await Promise.all(history.map(item => 
                api.delete(`/scan/history/item/${item._id}?studentId=${user._id}`)
              ));
              setHistory([]);
              toastSuccess("All scan history cleared.");
            } catch (e) {
              toastError("Failed to clear all history.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleToggleBookmark = async (item) => {
    try {
      const res = await api.put(`/scan-bookmark/${item._id}`);
      const updated = res.data.data;
      setHistory(prev => prev.map(h => h._id === item._id ? { ...h, bookmarked: updated.bookmarked } : h));
      toastSuccess(updated.bookmarked ? "Saved to Bookmarks" : "Removed from Bookmarks");
    } catch (err) {
      toastError("Failed to update bookmark");
    }
  };

  const renderItem = ({ item }) => {
    const d = new Date(item.createdAt);
    const timeString = d.toLocaleDateString() + ' • ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    return (
      <View style={[styles.cardWrapper, { backgroundColor: theme.card }]}>
        <Image source={{ uri: `${SERVER_URL}${item.imageUrl}` }} style={styles.scanThumb} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{item.classification}</Text>
          <Text style={{ color: theme.subText, fontSize: 12 }}>{Number(item.confidence).toFixed(1)}% Confidence</Text>
          <Text style={{ color: theme.subText, fontSize: 10, marginTop: 4 }}>{timeString}</Text>
        </View>
        <TouchableOpacity style={{ padding: 8 }} onPress={() => handleToggleBookmark(item)}>
          <Ionicons 
            name={item.bookmarked ? "bookmark" : "bookmark-outline"} 
            size={24} 
            color={item.bookmarked ? "#10b981" : theme.subText} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan History</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleClearAll}>
             <Ionicons name="trash-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabWrapper}>
        {['All', 'Yeast', 'Mold'].map((tab) => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.tabItem, activeFilter === tab && styles.activeTab]} 
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.tabLabel, { color: activeFilter === tab ? '#153c2a' : '#64748B' }]}>
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerBox}>
        <Ionicons name="information-circle" size={18} color="#059669" />
        <Text style={styles.disclaimerText}>
          Bookmarked scans are kept safe. Non-bookmarked scans are automatically archived after 30 days.
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color="#153c2a" /></View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Ionicons name="document-text-outline" size={60} color={theme.subText + '44'} style={{ marginBottom: 10 }} />
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>No scans found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { 
    backgroundColor: '#153c2a',
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 25, 
    borderBottomLeftRadius: 30, 
    borderBottomRightRadius: 30 
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  
  tabWrapper: { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: '#fff', elevation: 2 },
  tabLabel: { fontSize: 12, fontWeight: '800' },

  disclaimerBox: { marginHorizontal: 20, marginTop: 15, padding: 12, backgroundColor: '#ecfdf5', borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderColor: '#d1fae5', borderWidth: 1 },
  disclaimerText: { color: '#065f46', fontSize: 12, fontWeight: '600', marginLeft: 8, flex: 1 },

  cardWrapper: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  scanThumb: { width: 55, height: 55, borderRadius: 10, backgroundColor: '#eee' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
});