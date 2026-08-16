import React, { useContext, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../Pages/src/context/ThemeContext'

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Notifications({ route, navigation }) {
  const { theme } = useContext(ThemeContext);

  const notifications = route.params?.notifications || [];

  const renderNotifItem = useCallback(({ item }) => (
    <View style={localStyles.notifItem}>
      <View style={[localStyles.notifIconBox, !item.isRead && { backgroundColor: '#C5DEC9' }]}>
        <Ionicons 
          name={item.type === 'dataset' ? 'cube-outline' : item.type === 'calendar' ? 'calendar-outline' : item.type === 'assessment' ? 'clipboard-outline' : 'notifications-outline'} 
          size={20} 
          color="#153c2a" 
        />
      </View>
      <View style={localStyles.notifContent}>
        <Text style={[localStyles.notifText, !item.isRead && { fontWeight: '900' }]}>{item.message}</Text>
        <Text style={localStyles.notifTime}>{formatDate(item.createdAt)}</Text>
      </View>
    </View>
  ), []);

  const renderEventItem = useCallback(({ item }) => (
    <View style={localStyles.eventItem}>
      <View style={[localStyles.eventColorIndicator, { backgroundColor: item.color }]} />
      <View style={localStyles.eventContent}>
        <Text style={localStyles.eventTitle}>{item.title}</Text>
        <Text style={localStyles.eventDate}>{formatDate(item.date)}</Text>
      </View>
      <View style={localStyles.eventTypeBadge}>
        <Text style={localStyles.eventTypeText}>{item.type}</Text>
      </View>
    </View>
  ), []);

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
  data={calendarEvents}
  keyExtractor={(item) => item.id.toString()}
  showsVerticalScrollIndicator={false}
  renderItem={renderEventItem}
  initialNumToRender={10}          // Limits initial paint to 10 items
  maxToRenderPerBatch={10}         // Only loads 10 at a time while scrolling
  windowSize={5}                   // Reduces memory usage of off-screen items
  removeClippedSubviews={true}     // Unmounts items that leave the screen
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
  listContainer: { padding: 20 },
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