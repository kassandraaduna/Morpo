import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function StudentHomepage() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.logo}>MyphoLens</Text>

        <View style={styles.profilePill}>
          <Text style={styles.profileText}>Student Name</Text>
          <View style={styles.statusDot} />
        </View>
      </View>

      <Text style={styles.greeting}>Hello, Student Name!</Text>

      {/* SEARCH */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#777" />
        <TextInput
          placeholder="Search"
          style={styles.searchInput}
        />
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.grid}>
        {[
          'AI CLASSIFIER',
          '3D MODELS',
          'LEARN MYCOLOGY',
          'ASSESSMENTS',
          'BOOKMARKS',
          'SCAN HISTORY',
        ].map((label, i) => (
          <TouchableOpacity key={i} style={styles.gridItem}>
            <View style={styles.gridIcon} />
            <Text style={styles.gridLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* RECENT SCANS */}
      <Text style={styles.sectionTitle}>RECENT SCANS</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[1, 2].map((_, i) => (
          <View key={i} style={styles.scanCard}>
            <View style={styles.scanImage} />

            <View style={styles.scanContent}>
              <View style={styles.scanHeader}>
                <Text style={styles.scanTitle}>YEAST</Text>
                <Ionicons name="bookmark-outline" size={18} />
              </View>

              <Text style={styles.scanMeta}>
                date & time{'\n'}confidence score
              </Text>

              <View style={styles.scanActions}>
                <TouchableOpacity style={styles.outlineBtn}>
                  <Text style={styles.outlineText}>LEARN MORE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn}>
                  <Text style={styles.outlineText}>VIEW MODEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* LATEST ASSESSMENT */}
      <Text style={styles.sectionTitle}>LATEST ASSESSMENT SCORE</Text>

      <View style={styles.assessmentCard}>
        <View>
          <Text style={styles.assessmentTitle}>ASSESSMENT NAME</Text>
          <Text style={styles.assessmentMeta}>no. of attempts</Text>
          <Text style={styles.assessmentFeedback}>
            Excellent identification of all characteristics! Keep it up!
          </Text>
        </View>

        <View style={styles.scoreBox}>
          <Text style={styles.score}>90</Text>
          <TouchableOpacity style={styles.viewBtn}>
            <Text style={styles.viewText}>VIEW</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* RECENTLY VIEWED */}
      <Text style={styles.sectionTitle}>RECENTLY VIEWED TOPICS</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[
          'CHARACTERISTICS OF FUNGI',
          'BASIC MORPHOLOGICAL FORMS',
          'FUNDAMENTAL UNIT OF FUNGI',
        ].map((topic, i) => (
          <View key={i} style={styles.topicCard}>
            <View style={styles.topicImage} />
            <Text style={styles.topicText}>{topic}</Text>
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFF' },
  container: { padding: 16, paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: { fontWeight: '800', fontSize: 18 },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  profileText: { fontSize: 12, marginRight: 6 },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#BEEA4B',
  },

  greeting: {
    fontSize: 20,
    fontWeight: '700',
    marginVertical: 14,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 14,
    height: 42,
    marginBottom: 20,
  },
  searchInput: { marginLeft: 8, flex: 1 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gridItem: { width: '30%', alignItems: 'center', marginBottom: 18 },
  gridIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#F8E7EB',
    borderRadius: 12,
    marginBottom: 6,
  },
  gridLabel: { fontSize: 11, textAlign: 'center' },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },

  scanCard: {
    width: 280,
    flexDirection: 'row',
    backgroundColor: '#FCE9ED',
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
  },
  scanImage: {
    width: 60,
    height: 60,
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginRight: 10,
  },
  scanContent: { flex: 1 },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scanTitle: { fontWeight: '700' },
  scanMeta: { fontSize: 11, color: '#666', marginVertical: 6 },
  scanActions: { flexDirection: 'row', gap: 6 },
  outlineBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  outlineText: { fontSize: 10 },

  assessmentCard: {
    backgroundColor: '#D6EEAA',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  assessmentTitle: { fontWeight: '700' },
  assessmentMeta: { fontSize: 11 },
  assessmentFeedback: { fontSize: 11, marginTop: 6 },

  scoreBox: { alignItems: 'center' },
  score: { fontSize: 22, fontWeight: '800' },
  viewBtn: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 6,
  },
  viewText: { fontSize: 12, fontWeight: '700' },

  topicCard: {
    width: 140,
    borderWidth: 1,
    borderRadius: 14,
    marginRight: 12,
    overflow: 'hidden',
  },
  topicImage: { height: 90, backgroundColor: '#FCE9ED' },
  topicText: {
    padding: 8,
    fontSize: 11,
    textAlign: 'center',
  },
});
