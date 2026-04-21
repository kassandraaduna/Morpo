import React, { useEffect, useState, useContext } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Image, StyleSheet, Platform, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ConfirmSheet from './src/components/ConfirmSheet';
import { ThemeContext } from './src/context/ThemeContext';
import { toAbsUrl } from './src/services/api';

const getInitials = (fname, lname) => {
  const f = fname ? fname.charAt(0).toUpperCase() : '';
  const l = lname ? lname.charAt(0).toUpperCase() : '';
  return `${f}${l}` || 'U';
};

export default function Profile({ navigation }) {
  const [user, setUser] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { theme, darkMode, toggleTheme } = useContext(ThemeContext);

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

  const isInstructor = String(user.role || '').toLowerCase() === 'instructor';

  const Row = ({ label, icon, onPress, right, chevron = true }) => (
    <TouchableOpacity 
      style={[localStyles.row, { backgroundColor: theme.card }]} 
      onPress={onPress} 
      activeOpacity={0.7} 
      disabled={!onPress}
    >
      <View style={localStyles.rowLeft}>
        <View style={[localStyles.iconBox, { backgroundColor: '#153c2a15' }]}>
          <Ionicons name={icon} size={20} color="#153c2a" />
        </View>
        <Text style={[localStyles.rowText, { color: theme.text }]}>{label}</Text>
      </View>
      {right ? right : chevron && <Ionicons name="chevron-forward" size={18} color={theme.subText} />}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />

      <View style={[localStyles.header, { backgroundColor: '#153c2a' }]}>
        <View style={localStyles.headerTop}>
          <Text style={localStyles.headerTitle}>Profile & Settings</Text>
          <Text style={localStyles.headerSubtitle}>
            Manage your account and preferences
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 50, paddingHorizontal: 20 }}>
        <View style={[localStyles.profileCard, { backgroundColor: theme.card }]}>
          <View style={localStyles.avatarContainer}>
            {user.avatar ? (
              <Image source={{ uri: toAbsUrl(user.avatar) }} style={localStyles.avatarImage} />
            ) : (
              <Text style={localStyles.initialsText}>
                {getInitials(user.fname, user.lname)}
              </Text>
            )}
          </View>

          <View style={localStyles.profileTextContainer}>
            <Text style={[localStyles.nameText, { color: theme.text }]}>
              {user.fname} {user.lname}
            </Text>
            <Text style={localStyles.emailText}>{user.email}</Text>
            
            <View style={localStyles.roleBadge}>
              <Text style={localStyles.roleText}>{user.role || 'Student'}</Text>
            </View>
          </View>
        </View>

        <Text style={localStyles.sectionTitle}>ACCOUNT DETAILS</Text>
        <Row label="Account Information" icon="person-outline" onPress={() => navigation.navigate('EditProfile')} />
        <Row label="Bookmarks" icon="bookmark-outline" onPress={() => navigation.navigate('Bookmarks')} />
        <Row label="Scan History" icon="time-outline" onPress={() => navigation.navigate('ScanHistory')} />
        
        {isInstructor && (
          <Row label="Dataset Library" icon="images-outline" onPress={() => navigation.navigate('DatasetLibrary')} />
        )}

        <Text style={localStyles.sectionTitle}>PREFERENCES</Text>
        <Row 
          label="Dark Mode" 
          icon="moon-outline" 
          chevron={false} 
          right={<Switch value={darkMode} onValueChange={toggleTheme} trackColor={{ false: "#ccc", true: "#153c2a" }} />} 
        />
        <Row label="Change Password" icon="lock-closed-outline" onPress={() => navigation.navigate('ChangePassword')} />

        <Text style={localStyles.sectionTitle}>SUPPORT</Text>
        <Row label="FAQs" icon="help-circle-outline" onPress={() => navigation.navigate('FAQs')} />
        <Row label="Terms & Conditions" icon="document-text-outline" onPress={() => navigation.navigate('Terms')} />
        <Row label="Privacy Policy" icon="shield-checkmark-outline" onPress={() => navigation.navigate('Privacy')} />
        <Row label="About MyphoLens" icon="information-circle-outline" onPress={() => navigation.navigate('About')} />

        <TouchableOpacity style={localStyles.logoutBtn} onPress={() => setConfirmLogout(true)}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={localStyles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>
      </ScrollView>

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
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: { 
      paddingHorizontal: 20, 
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 25,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30
    },
    headerTop: { 
      flexDirection: 'column',
      alignItems: 'flex-start',
      marginBottom: 20 
    },
    headerTitle: { 
      fontSize: 24, 
      fontWeight: '900', 
      color: '#fff',
      marginTop: 20,
    },
    headerSubtitle: { 
      fontSize: 13, 
      color: '#d1fae5', 
      marginTop: 2 
    },
  profileCard: { 
    flexDirection: 'row', alignItems: 'center', marginTop: 25, marginBottom: 20, 
    padding: 20, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 
  },
  avatarContainer: { 
    width: 75, height: 75, borderRadius: 40, backgroundColor: '#E7F5EE', 
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden' 
  },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  initialsText: { fontSize: 26, fontWeight: '900', color: '#94A3B8' },
  profileTextContainer: { flex: 1, marginLeft: 16 },
  nameText: { fontSize: 20, fontWeight: '900' },
  emailText: { fontSize: 13, color: '#64748B', marginTop: 2, fontWeight: '500' },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: '#e7f8f2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  roleText: { color: '#153c2a', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#153c2a', marginTop: 15, marginBottom: 10, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 16, marginBottom: 8, elevation: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowText: { fontSize: 14, fontWeight: '700' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', padding: 18, borderRadius: 16, marginTop: 30, marginBottom: 10, borderWidth: 1, borderColor: '#FEE2E2' },
  logoutText: { color: '#EF4444', fontWeight: '900', fontSize: 15, marginLeft: 8 }
});