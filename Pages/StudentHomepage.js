import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './src/styles/Styles';
import { ThemeContext } from './src/context/ThemeContext';

export default function StudentHomepage({navigation}) {
  const [user, setUser] = useState(null);
  const { theme } = useContext(ThemeContext);

  /* ============ LOAD USER ============ */
  useEffect(() => {
    const loadUser = async () => {
      const rawUser = await AsyncStorage.getItem('user');
      if (rawUser) {
        setUser(JSON.parse(rawUser));
      }
    };

    loadUser();
    const unsubscribe = navigation?.addListener?.('focus', loadUser);
    return unsubscribe;
  }, [navigation]);  

  if (!user) return null;

  return (
    <ScrollView
      style={[styles.scrollScreen, { backgroundColor: theme.bg }]}
      contentContainerStyle={[styles.pageContainer, { paddingBottom: 50 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.studentHeader}>
        <Text style={[styles.appTitle, { color: theme.text }]}>MyphoLens</Text>
        <View
          style={[
            styles.profilePill,
            { backgroundColor: theme.card },
          ]}
        >
          {user.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={{
                width: 30,
                height: 30,
                borderRadius: 14,
                marginRight: 8,
              }}
            />
          ) : (
            <Ionicons
              name="person-circle-outline"
              size={25}
              color={theme.text}
              style={{ marginRight: 8 }}
            />
          )}

          <Text
            style={[styles.profileName, { color: theme.text }]}
          >
            {user.fname} {user.lname}
          </Text>
        </View>
      </View>

      {/* GREETING */}
      <Text style={[styles.greeting, { color: theme.text }]}>Hello, {user.fname} {user.lname}</Text>

      {/* SEARCH */}
      <View style={[styles.searchBar, {backgroundColor: theme.search, borderColor: theme.subText,}]}>
        <Ionicons name="search-outline" size={18} color="#777" />
        <TextInput
          placeholder="Search"
          placeholderTextColor="#999"
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <View style={styles.grid}>
        {[
          'AI CLASSIFIER',
          '3D MODELS',
          'LEARN MYCOLOGY',
          'ASSESSMENTS',
          'BOOKMARKS',
          'SCAN HISTORY',
        ].map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.quickCard,
            ]}
          >
            <View
              style={[
                styles.gridIcon,
                { backgroundColor: theme.subText },
              ]}
            />
            <Text
              style={[
                styles.gridLabel,
                { color: theme.text },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* RECENT SCANS */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>RECENT SCANS</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[1, 2].map((_, i) => (
          <View key={i} style={styles.scanCard}>
            <View style={styles.scanImage} />

            <View style={{ marginTop: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '700' }}>YEAST</Text>
                <Ionicons name="bookmark-outline" size={18} />
              </View>

              <Text style={styles.scanMeta}>
                date & time{'\n'}confidence score
              </Text>

              <Text style={{ fontSize: 11, marginVertical: 6 }}>
                SHORT DESCRIPTION / OVERVIEW ABOUT CLASSIFICATION
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
      <Text style={[styles.sectionTitle, { color: theme.text }]}>LATEST ASSESSMENT SCORE</Text>

      <View style={styles.assessmentCard}>
        <View style={{ flex: 1 }}>
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
      <Text style={[styles.sectionTitle, { color: theme.text }]}>RECENTLY VIEWED TOPICS</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[
          'CHARACTERISTICS OF FUNGI',
          'BASIC MORPHOLOGICAL FORMS',
          'FUNDAMENTAL UNIT OF FUNGI',
        ].map((topic, i) => (
          <View key={i} style={[styles.topicCard, {borderColor: theme.subText}]}>
            <View style={styles.topicImage} />
            <Text style={[styles.topicText, { color: theme.text }]}>{topic}</Text>
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}
