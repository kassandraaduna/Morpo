import React, { useEffect, useState, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import styles from './src/styles/Styles';
import ConfirmSheet from './src/components/ConfirmSheet';
import { ThemeContext } from './src/context/ThemeContext';

export default function Profile({ navigation }) {
  const [user, setUser] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { theme, darkMode, toggleTheme } = useContext(ThemeContext);

  /* ============ LOAD USER ============ */
  useEffect(() => {
    const loadUser = async () => {
      const rawUser = await AsyncStorage.getItem('user');
      if (rawUser) {
        setUser(JSON.parse(rawUser));
      }
    };
    loadUser();
    const unsubscribe = navigation.addListener('focus', loadUser);

    return unsubscribe;
  }, [navigation]);

  if (!user) return null;

  /* ============ REUSABLE ROW ============ */
  const Row = ({ label, onPress, right, chevron = true }) => (
    <TouchableOpacity
      style={[
        styles.accountRow,
        { backgroundColor: theme.card },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <Text style={[styles.accountRowText, { color: theme.text }]}>
        {label}
      </Text>

      {right
        ? right
        : chevron && (
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.text}
            />
          )}
    </TouchableOpacity>
  );

  return (
    <>
      <ScrollView
        style={[
          styles.accountContainer,
          { backgroundColor: theme.bg },
        ]}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        {/* HEADER */}
        <View style={styles.accountHeader}>
          <View style={styles.headerSide} />
          <Text style={[styles.accountTitle, { color: theme.text }]}>
            ACCOUNT
          </Text>
          <View style={styles.headerSide} />
        </View>

        {/* PROFILE */}
        <View style={styles.accountProfileRow}>
        <View
          style={[
            styles.accountAvatar,
            {
              backgroundColor: theme.card,
              overflow: 'hidden',
            },
          ]}
        >
          {user.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 100,
              }}
            />
          ) : (
            <Ionicons
              name="camera-outline"
              size={20}
              color={theme.text}
            />
          )}
        </View>

          <View style={styles.accountProfileText}>
            <Text
              style={[styles.accountName, { color: theme.text }]}>
              {user.fname} {user.lname}
            </Text>
            <Text
              style={[
                styles.accountEmail,
                { color: theme.subText },
              ]}
            >
              {user.email}
            </Text>
          </View>
        </View>

        {/* ACCOUNT */}
        <Row
          label="ACCOUNT INFORMATION"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <Row
          label="BOOKMARKED SCANS"
          onPress={() => navigation.navigate('Bookmarks')}
        />
        <Row
          label="SCAN HISTORY"
          onPress={() => navigation.navigate('ScanHistory')}
        />

        {/* GENERAL */}
        <Text
          style={[
            styles.accountSection,
            { color: theme.text },
          ]}
        >
          GENERAL
        </Text>

        {/* DARK MODE */}
        <Row
          label="DARK MODE"
          chevron={false}
          right={
            <View style={{ transform: [{ scale: 0.85 }] }}>
              <Switch
                value={darkMode}
                onValueChange={toggleTheme}
              />
            </View>
          }
        />

        <Row
          label="CHANGE PASSWORD"
          onPress={() => navigation.navigate('ChangePassword')}
        />

        {/* SUPPORT */}
        <Text
          style={[
            styles.accountSection,
            { color: theme.text },
          ]}
        >
          SUPPORT
        </Text>

        <Row label="FAQS" onPress={() => navigation.navigate('FAQs')} />
        <Row
          label="TERMS & CONDITIONS"
          onPress={() => navigation.navigate('Terms')}
        />
        <Row
          label="PRIVACY POLICY"
          onPress={() => navigation.navigate('Privacy')}
        />
        <Row
          label="ABOUT MYPHOLENS"
          onPress={() => navigation.navigate('About')}
        />

        {/* LOGOUT */}
        <TouchableOpacity
          style={[
            styles.accountLogoutRow,
            { backgroundColor: theme.card },
          ]}
          onPress={() => setConfirmLogout(true)}
        >
          <Text
            style={[
              styles.accountRowText,
              { color: theme.text },
            ]}
          >
            LOGOUT
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* LOGOUT CONFIRMATION */}
      <ConfirmSheet
        visible={confirmLogout}
        title="Log out?"
        message="You will need to log in again."
        confirmText="Log out"
        danger
        onCancel={() => setConfirmLogout(false)}
        onConfirm={async () => {
          await AsyncStorage.clear();
          setConfirmLogout(false);
          navigation.replace('Login');
        }}
      />
    </>
  );
}
