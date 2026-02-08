import React, { useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './src/styles/Styles';
import { ThemeContext } from './src/context/ThemeContext';

export default function InstructorHomepage() {
  const { theme } = useContext(ThemeContext);

  return (
    <ScrollView
      style={[styles.scrollScreen, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.pageContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Text style={[styles.appTitle, { color: theme.text }]}>
          MyphoLens
        </Text>

        <View
          style={[
            styles.profilePill,
            { backgroundColor: theme.card },
          ]}
        >
          <Ionicons
            name="person-circle-outline"
            size={22}
            color={theme.text}
          />
          <Text
            style={[styles.profileName, { color: theme.text }]}
          >
            Prof. Dela Cruz
          </Text>
        </View>
      </View>

      <Text style={[styles.greeting, { color: theme.text }]}>
        Hello, Prof. Dela Cruz!
      </Text>

      {/* SEARCH */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: theme.search },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={18}
          color={theme.subText}
        />
        <TextInput
          placeholder="Search"
          placeholderTextColor={theme.subText}
          style={[
            styles.searchInput,
            { color: theme.text },
          ]}
        />
      </View>

      <View style={styles.grid}>
        {[
          'AI SCAN',
          'EDUCATIONAL CONTENT',
          'MODEL LIBRARY',
          'ASSESSMENTS',
          'BOOKMARKED SCANS',
          'SCAN HISTORY',
          'STUDENT PERFORMANCE',
          'DATASET MANAGEMENT',
        ].map((label, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.gridItem,
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

      {/* TOTAL STUDENTS */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        TOTAL STUDENTS
      </Text>

      <View
        style={[
          styles.statsCard,
          { backgroundColor: theme.card },
        ]}
      >
        <View
          style={[
            styles.statsIcon,
            { backgroundColor: theme.subText },
          ]}
        />
        <View>
          <Text
            style={[
              styles.statsNumber,
              { color: theme.text },
            ]}
          >
            179
          </Text>
          <Text
            style={[
              styles.statsLabel,
              { color: theme.subText },
            ]}
          >
            Total Students Enrolled
          </Text>
        </View>
      </View>

      {/* ALERTS */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        ALERTS / HIGHLIGHTS
      </Text>

      <View
        style={[
          styles.alertCard,
          styles.alertDanger,
          { backgroundColor: theme.card },
        ]}
      >
        <Text
          style={[
            styles.alertTitle,
            { color: theme.text },
          ]}
        >
          LOW PERFORMANCE ASSESSMENT
        </Text>
        <Text
          style={[
            styles.alertText,
            { color: theme.subText },
          ]}
        >
          A student scored below 60%
        </Text>
      </View>

      <View
        style={[
          styles.alertCard,
          styles.alertWarning,
          { backgroundColor: theme.card },
        ]}
      >
        <Text
          style={[
            styles.alertTitle,
            { color: theme.text },
          ]}
        >
          NEW DATASET SUBMISSION
        </Text>
        <Text
          style={[
            styles.alertText,
            { color: theme.subText },
          ]}
        >
          19 images submitted for your review
        </Text>
      </View>
    </ScrollView>
  );
}
