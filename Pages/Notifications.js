import React, { useContext, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../Pages/src/context/ThemeContext'; // Adjust path if necessary

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Notifications({ route, navigation }) {
  const { theme } = useContext(ThemeContext);

  // Safely grab the notifications passed from previous screens
  const notifications = route.params?.notifications || [];

  // THE FIX: Makes items clickable and routes them dynamically based on type
  const renderNotifItem = useCallback(({ item }) => {
    const handlePress = () => {
        if (item.type === 'dataset') navigation.navigate('DatasetLibrary');
        else if (item.type === 'scan') navigation.navigate('ScanHistory');
        else if (item.type === 'assessment') navigation.navigate('Learn', { initialTab: 'Assessments' });
        else if (item.type === 'lesson') navigation.navigate('Learn', { initialTab: 'Lessons' });
        else if (item.type === 'assignment') navigation.navigate('StudentMonitoring');
        else if (item.type === 'calendar') navigation.goBack(); 
    };

    return (
      <TouchableOpacity style={styles.notifItem} onPress={handlePress} activeOpacity={0.7}>
        <View style={[styles.notifIconBox, !item.isRead && { backgroundColor: '#C5DEC9' }]}>
          <Ionicons 
            name={item.type === 'dataset' ? 'cube-outline' : item.type === 'scan' ? 'scan-outline' : item.type === 'calendar' ? 'calendar-outline' : item.type === 'assessment' ? 'clipboard-outline' : item.type === 'lesson' ? 'book-outline' : 'notifications-outline'} 
            size={20} 
            color="#153c2a" 
          />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifText, !item.isRead && { fontWeight: '900' }]}>{item.message}</Text>
          <Text style={styles.notifTime}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme?.bg || '#F4F7F6' }]}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#153c2a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} /> {/* Spacer for alignment */}
      </View>

      {/* NOTIFICATIONS LIST */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>You have no new notifications.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications} // THE FIX: Rendering notifications instead of calendar events
          keyExtractor={(item, index) => item._id?.toString() || index.toString()}
          showsVerticalScrollIndicator={false}
          renderItem={renderNotifItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#153c2a' },
  listContainer: { padding: 20, paddingBottom: 60 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, color: '#64748B', marginTop: 16, fontWeight: '600' },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  notifIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E7F5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  notifContent: { flex: 1 },
  notifText: { fontSize: 14, fontWeight: '600', color: '#1E293B', lineHeight: 20 },
  notifTime: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 6 }
});