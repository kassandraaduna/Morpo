import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, StyleSheet, Platform, StatusBar, Dimensions, ActivityIndicator, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { toastError, toastSuccess } from './src/components/ToastMsg';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const { width } = Dimensions.get('window');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getInitials = (name) => {
  if (!name) return 'S';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const getAvatarUri = (url, u) => {
  if (!url) return null;
  if (url.startsWith('data:image') || url.startsWith('file:')) return url;
  return `${toAbsUrl(url)}?v=${u?.updatedAt || '1'}`;
};

const extractArray = (resData) => {
    if (!resData) return [];
    if (Array.isArray(resData)) return resData;
    if (typeof resData === 'object') {
        if (Array.isArray(resData.data) && resData.data.length > 0) return resData.data;
        if (resData.data?.data && Array.isArray(resData.data.data)) return resData.data.data;
        for (const key in resData) {
            if (Array.isArray(resData[key]) && resData[key].length > 0) return resData[key];
        }
    }
    return [];
};

const getUserId = (field) => {
    if (!field) return null;
    if (typeof field === 'string') return field.trim();
    if (typeof field === 'object') {
        if (field._id) return String(field._id).trim();
        if (field.id) return String(field.id).trim();
    }
    return null;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function StudentHomepage({ navigation }) {
  const [user, setUser] = useState(null);
  const [scans, setScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [latestQuiz, setLatestQuiz] = useState(null);
  const [suggestedLessons, setSuggestedLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState({ lessons: [], models: [], scans: [] });
  const [usersMap, setUsersMap] = useState({});

  const [notifications, setNotifications] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const today = new Date();
  const initDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [selectedDateStr, setSelectedDateStr] = useState(initDateStr);

  const { theme } = useContext(ThemeContext);
  const printRef = useRef();

  const registerForPushNotificationsAsync = async (userId) => {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#153c2a',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }

      try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        
        if (projectId) {
          token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        } else {
          token = (await Notifications.getExpoPushTokenAsync()).data;
        }
        
        console.log("My Expo Push Token is: ", token);
        
      } catch (tokenErr) {
        console.error("Token generation failed:", tokenErr);
        return;
      }

      if (token && userId) {
        try {
          await api.put(`/users/${userId}/push-token`, { token });
          console.log("Push token successfully saved to MongoDB!");
        } catch (err) {
          console.error("Failed to sync push token:", err);
        }
      }
    } else {
      console.log('Must use a physical device for Push Notifications');
    }
  };

  const loadDashboardData = async () => { 
        try { 
            setLoading(true);
            const rawUser = await AsyncStorage.getItem('user'); 
            const token = await AsyncStorage.getItem('token');
            if (!rawUser) {
                setLoading(false);
                return;
            }
            
            let currentUser = JSON.parse(rawUser); 
            setUser(currentUser);

            const config = {
              headers: { Authorization: token ? `Bearer ${token}` : '' }
            };

            try {
                const userRes = await api.get(`/meds/${currentUser._id}`, config).catch(() => api.get(`/admin/users/${currentUser._id}`, config));
                const updatedUser = userRes.data?.data || userRes.data;
                if (updatedUser) {
                    currentUser = updatedUser;
                    setUser(currentUser);
                    await AsyncStorage.setItem('user', JSON.stringify(currentUser));
                }
            } catch (err) {}

            const [
                usersRes, syRes, lessonsRes, remedialRes, scansRes, bookmarksRaw, calRes, assessRes, 
                officialHistoryRes, unifiedHistoryRes, recentLessonsRaw, readNotifsRaw, clearedNotifsRaw
            ] = await Promise.all([
                api.get('/admin/users', config).catch(() => api.get('/getMed', config).catch(() => ({ data: [] }))),
                api.get('/admin/academic-settings/school-years', config).catch(() => ({ data: {} })),
                api.get('/lessons', config).catch(() => ({ data: { data: [] } })),
                api.get(`/ai/personalized-lessons/${currentUser._id}`, config).catch(() => ({ data: { data: [] } })),
                api.get(`/scan/history/${currentUser._id}`, config).catch(() => ({ data: { data: [] } })),
                AsyncStorage.getItem(`bookmarks_${currentUser._id}`).catch(() => null),
                api.get('/calendar/events', config).catch(() => ({ data: [] })),
                api.get(`/assessments?studentId=${currentUser._id}&_t=${Date.now()}`, config).catch(() => ({ data: [] })),
                api.get(`/assessments/history/${currentUser._id}?_t=${Date.now()}`, config).catch(() => ({ data: [] })),
                api.get(`/student/${currentUser._id}/assessment-history?_t=${Date.now()}`, config).catch(() => ({ data: [] })),
                AsyncStorage.getItem(`recent_lessons_${currentUser._id}`).catch(() => null),
                AsyncStorage.getItem('read_notifs').catch(() => null),
                AsyncStorage.getItem('cleared_notifs').catch(() => null)
            ]);

            const readNotifs = readNotifsRaw ? JSON.parse(readNotifsRaw) : [];
            const clearedNotifs = clearedNotifsRaw ? JSON.parse(clearedNotifsRaw) : [];
            if (bookmarksRaw) setBookmarks(JSON.parse(bookmarksRaw));

            const rawScans = extractArray(scansRes.data);
            setScans(rawScans);

            let allOfficialAttempts = [];
            const seenAttemptIds = new Set();

            const registerAttempt = (att, defaultTitle) => {
                if (!att) return;
                const id = String(att._id || '');
                if (!id || seenAttemptIds.has(id)) return;
                seenAttemptIds.add(id);

                const isPractice = att.isPracticeOnly || att.assessment?.isPracticeOnly;
                if (!isPractice && att.score !== undefined && att.score !== null) {
                    allOfficialAttempts.push({
                        _id: id,
                        assessmentId: att.assessmentId?._id || att.assessmentId || att.assessment?._id || att.assessment || att._id,
                        title: att.assessment?.title || att.assessmentId?.title || att.title || defaultTitle || 'Assessment',
                        score: att.score,
                        total: att.total || 100,
                        percent: att.percent !== undefined ? att.percent : Math.round((att.score / (att.total || 100)) * 100),
                        feedback: att.professorFeedback || att.feedback,
                        scorePending: Boolean(att.scorePending), 
                        timestamp: new Date(att.updatedAt || att.submittedAt || att.createdAt || 0).getTime()
                    });
                }
            };

            const allAssessments = extractArray(assessRes.data);
            allAssessments.forEach(a => {
                if (!a.isPracticeOnly && a.latestAttempt) {
                    registerAttempt({ ...a.latestAttempt, assessmentId: a._id }, a.title);
                }
            });

            const extractFromHistory = (historyData) => {
                const historyArray = extractArray(historyData?.history || historyData?.data || historyData);
                historyArray.forEach(att => registerAttempt(att));
            };

            extractFromHistory(officialHistoryRes.data);
            extractFromHistory(unifiedHistoryRes.data);

            allOfficialAttempts.sort((a, b) => b.timestamp - a.timestamp);

            if (allOfficialAttempts.length > 0) {
                const latest = allOfficialAttempts[0];
                setLatestQuiz({
                    title: latest.title,
                    submittedAt: new Date(latest.timestamp || Date.now()).toISOString(),
                    score: latest.score,
                    total: latest.total,
                    percent: latest.percent,
                    scorePending: latest.scorePending,
                    feedback: latest.feedback || (latest.percent >= 70 ? 'Passed' : 'Needs Review')
                });
            } else {
                setLatestQuiz(null);
            }

            const allUsers = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.data || []);
            const uMap = {};
            allUsers.forEach(u => {
                if (u._id || u.id) uMap[String(u._id || u.id)] = u;
            });
            setUsersMap(uMap);

            let plottedEvents = [];
            const events = extractArray(calRes.data?.events || calRes.data);
            events.forEach(ev => {
              if(ev.date) {
                plottedEvents.push({
                  id: ev._id || ev.id || `${ev.title}-${ev.date}`,
                  title: ev.title,
                  date: new Date(ev.date),
                  type: ev.type || 'event',
                  color: ev.color || '#153c2a',
                  createdAt: ev.createdAt || ev.updatedAt || new Date().toISOString() // <-- FIXED
                });
              }
            });

            allAssessments.forEach(a => {
              if(a.deadlineAt || a.closesAt) {
                plottedEvents.push({
                  id: `assess-${a._id}`,
                  title: `${a.title} Due`,
                  date: new Date(a.deadlineAt || a.closesAt),
                  type: 'assessment',
                  color: '#EF4444',
                  createdAt: a.createdAt || a.updatedAt || new Date().toISOString() // <-- FIXED
                });
              }
            });
            
            plottedEvents.sort((a, b) => a.date - b.date);
            setCalendarEvents(plottedEvents);

            const syContext = syRes.data?.context || {};
            const activeSyId = syContext.activeSchoolYearId;
            const activeTermKey = syContext.activeTermKey;

            const assignedInstructorIds = allUsers.filter(u => {
                if (String(u.role).toLowerCase() !== 'instructor') return false;
                const assignments = Array.isArray(u.instructorAssignments) ? u.instructorAssignments : [];
                return assignments.some(a => 
                    String(a.schoolYearId) === String(activeSyId) &&
                    (a.termKey === 'all' || a.termKey === activeTermKey) &&
                    a.yearLevel === currentUser.yearLevel &&
                    a.section === currentUser.section
                );
            }).map(u => String(u._id));

            const rawLessons = extractArray(lessonsRes.data);
            const validLessons = rawLessons.filter(l => {
                if (l.isArchived) return false;
                const creatorId = typeof l.createdBy === 'object' ? l.createdBy?._id : l.createdBy;
                return !creatorId || assignedInstructorIds.length === 0 || assignedInstructorIds.includes(String(creatorId));
            });

            const rawRemedial = extractArray(remedialRes.data);
            const combinedLessons = [
                ...validLessons.map(l => ({ ...l, type: 'normal' })),
                ...rawRemedial.map(l => ({ ...l, type: 'remedial', title: l.title || `Remedial: ${l.topic || 'Lesson'}`, updatedAt: l.createdAt || l.updatedAt }))
            ];

            const recentLessonsMap = recentLessonsRaw ? JSON.parse(recentLessonsRaw) : {};
            combinedLessons.forEach(l => {
                l.lastAccessedAt = recentLessonsMap[l._id] || 0;
            });

            combinedLessons.sort((a, b) => {
                if (a.lastAccessedAt > 0 || b.lastAccessedAt > 0) {
                    return b.lastAccessedAt - a.lastAccessedAt;
                }
                const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
                return dateB - dateA;
            });

            setSuggestedLessons(combinedLessons); 

            let generatedNotifs = [];

            allOfficialAttempts.forEach(latest => {
              if (!latest.scorePending) {
                  generatedNotifs.push({
                      _id: `score-${latest._id}-${latest.timestamp}`, 
                      type: 'assessment_score',
                      assessmentId: latest.assessmentId,
                      submissionId: latest._id,
                      message: `Score/Feedback released: ${latest.score}/${latest.total} (${latest.percent}%) on ${latest.title}`,
                      createdAt: new Date(latest.timestamp).toISOString(),
                      isRead: false
                  });
              }
          });

            rawScans.forEach(scan => {
                generatedNotifs.push({
                    _id: `scan-${scan._id}`,
                    type: 'scan',
                    message: `New AI scan saved: ${scan.classification || 'Unknown'}`,
                    createdAt: scan.createdAt || new Date().toISOString(),
                    isRead: false
                });
            });

            plottedEvents.forEach(event => {
                generatedNotifs.push({
                    _id: `cal-${event.id}`,
                    type: 'calendar',
                    message: `Upcoming event: ${event.title}`,
                    createdAt: event.createdAt,
                    isRead: false
                });
            });

            const officialAssessments = extractArray(assessRes.data).filter(a => a.status !== 'draft' && !a.isArchived);
            officialAssessments.forEach(ass => {
                const updateTime = new Date(ass.updatedAt || ass.createdAt || 0).getTime();
                
                generatedNotifs.push({
                    _id: `new-ass-${ass._id}-${updateTime}`,
                    type: 'new_assessment',
                    assessmentId: ass._id,
                    message: `Assessment update/available: ${ass.title}`,
                    createdAt: ass.updatedAt || ass.createdAt || new Date().toISOString(),
                    isRead: false
                });
            });

            combinedLessons.forEach(lesson => {
                const updateTime = new Date(lesson.updatedAt || lesson.createdAt || 0).getTime();

                generatedNotifs.push({
                    _id: `lesson-${lesson._id}-${updateTime}`,
                    type: 'new_lesson',
                    lessonId: lesson._id,
                    message: `Material update/available: ${lesson.title}`,
                    createdAt: lesson.updatedAt || lesson.createdAt || new Date().toISOString(),
                    isRead: false
                });
            });

            generatedNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
            const mappedNotifs = generatedNotifs
                .filter(n => !clearedNotifs.includes(n._id))
                .map(n => ({
                    ...n,
                    isRead: readNotifs.includes(n._id)
                }));
                
            setNotifications(mappedNotifs);

        } catch (error) {
            console.error("Dashboard Fetch Error:", error);
        } finally {
            setLoading(false);
        }
  };

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#F8F9FA');
      }

      loadDashboardData();
    }, [])
  );

  const handleToggleBookmark = async (itemId, type) => {
        try {
            if (type === 'scan') {
                const res = await api.put(`/scan-bookmark/${itemId}`);
                const updated = res.data.data;
                
                setScans(prev => prev.map(s => s._id === itemId ? { ...s, bookmarked: updated.bookmarked } : s));
                
                if (updated.bookmarked) {
                    toastSuccess('Scan saved to Bookmarks');
                } else {
                    toastSuccess('Scan removed from Bookmarks');
                }
                
            } else if (type === 'lesson') {
                let newBookmarks = { ...bookmarks };
                if (!newBookmarks.lessons) newBookmarks.lessons = [];

                if (newBookmarks.lessons.includes(itemId)) {
                    newBookmarks.lessons = newBookmarks.lessons.filter(id => id !== itemId);
                    toastSuccess('Lesson removed from Bookmarks');
                } else {
                    newBookmarks.lessons.push(itemId);
                    toastSuccess('Lesson saved to Bookmarks');
                }
                
                setBookmarks(newBookmarks);
                await AsyncStorage.setItem(`bookmarks_${user._id}`, JSON.stringify(newBookmarks));
            }
        } catch (error) {
            console.error(`Failed to toggle ${type} bookmark:`, error);
            toastError(`Failed to update ${type} bookmark.`);
        }
    };

  const handleDownload = async () => {
        try {
            setIsDownloading(true);

            const localUri = await captureRef(printRef, {
                format: "jpg",
                quality: 1,
            });
            
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
                await MediaLibrary.saveToLibraryAsync(localUri);
                toastSuccess('Image with metadata saved to gallery!');
            } else {
                toastError('Storage permission is required to save the image.');
            }
        } catch (err) {
            console.error("Download Error:", err);
            toastError('Failed to process and save the image.');
        } finally {
            setIsDownloading(false);
        }
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  const getSelectedEvents = () => {
    if (!selectedDateStr) return [];
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    return calendarEvents.filter(ev => {
      const evDt = new Date(ev.date);
      return evDt.getFullYear() === y && evDt.getMonth() === m - 1 && evDt.getDate() === d;
    });
  };

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

  const renderCalendarGrid = () => {
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={localStyles.dayCell} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const yyyy = calendarYear;
      const mm = String(calendarMonth + 1).padStart(2, '0');
      const dd = String(i).padStart(2, '0');
      const cellDateKey = `${yyyy}-${mm}-${dd}`;

      const isSelected = selectedDateStr === cellDateKey;

      const dayEvents = calendarEvents.filter(ev => {
        const evDt = new Date(ev.date);
        return evDt.getFullYear() === yyyy && evDt.getMonth() === calendarMonth && evDt.getDate() === i;
      });

      const colors = [...new Set(dayEvents.map(e => e.color))].slice(0, 3);

      days.push(
        <TouchableOpacity 
          key={`day-${i}`} 
          style={[localStyles.dayCell, isSelected && localStyles.cellSelected]}
          onPress={() => setSelectedDateStr(cellDateKey)}
        >
          <Text style={[localStyles.dayText, isSelected && localStyles.cellTextSelected]}>{i}</Text>
          <View style={localStyles.dotsRow}>
            {colors.map((c, idx) => (
              <View key={idx} style={[localStyles.dot, { backgroundColor: c }]} />
            ))}
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View>
        <View style={localStyles.daysOfWeekRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
            <Text key={idx} style={localStyles.dayOfWeekText}>{d}</Text>
          ))}
        </View>
        <View style={localStyles.daysGridContainer}>
          {days}
        </View>
      </View>
    );
  };

  // FIXED: Hook called before Early Return
  useEffect(() => {
    if (user?._id) {
      registerForPushNotificationsAsync(user._id);
    }
  }, [user?._id]);

  if (!user || loading) {
    return (
      <View style={[localStyles.centered, { backgroundColor: theme?.bg || '#F8F9FA' }]}>
        <ActivityIndicator size="large" color="#153c2a" />
      </View>
    );
  }

  const fullName = `${user.fname || ''} ${user.lname || ''}`.trim() || 'Student User';
  const recentScansList = scans.slice(0, 5);
  const recentLessonsList = suggestedLessons.slice(0, 5);
  const hasValidAssessment = latestQuiz && latestQuiz.score !== undefined && latestQuiz.score !== null;
  const selectedEvents = getSelectedEvents();
  const unreadNotifs = notifications.filter(n => !n.isRead).length;

  const legendsMap = {};
  calendarEvents.forEach(e => { legendsMap[e.type] = e.color; });
  const legendEntries = Object.keys(legendsMap).map(type => ({ type, color: legendsMap[type] }));

  return (
    <View style={[localStyles.container, { backgroundColor: theme?.bg || '#F8F9FA' }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" />

      <View style={localStyles.topHeaderBar}>
        <Text style={[localStyles.headerTitle, { color: '#153c2a' || theme?.text }]}>Home</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowCalendar(true)} style={[localStyles.notificationBell, { marginRight: 12 }]}>
            <Ionicons name="calendar" size={22} color="#153c2a" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={localStyles.notificationBell} 
            onPress={() => navigation.navigate('Notifications', { notifications, role: 'student' })}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications" size={22} color="#153c2a" />
            {unreadNotifs > 0 && (
              <View style={localStyles.badge}>
                <Text style={localStyles.badgeText}>{unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={localStyles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Welcome Banner Card */}
        <View style={localStyles.welcomeBanner}>
          <View style={localStyles.welcomeTextContainer}>
            <Text style={localStyles.welcomeSubText}>Welcome back,</Text>
            <Text style={localStyles.welcomeUserName} numberOfLines={1}>{fullName}</Text>
          </View>
          <View style={localStyles.welcomeAvatarCircle}>
            {user?.avatar ? (
              <Image source={{ uri: getAvatarUri(user.avatar, user) }} style={localStyles.avatarImage} />
            ) : (
              <Text style={localStyles.avatarInitials}>{getInitials(fullName)}</Text>
            )}
          </View>
        </View>

        {/* Quick Links Section */}
        <View style={localStyles.sectionHeadingRow}>
          <Ionicons name="link" size={25} color="#153c2a" style={{ marginRight: 10 }} />
          <Text style={[localStyles.sectionHeaderTitle, { color: '#153c2a' || theme?.text  }]}>Quick Links</Text>
        </View>

        <View style={localStyles.quickLinksGrid}>
          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Learn', { initialTab: 'Lessons' })}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="book" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Lessons</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Learn', { initialTab: '3D Models' })}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="cube" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>3D Models</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Assessments')}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="clipboard" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Assessments</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Scan')}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="scan" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>AI Scanner</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('Bookmarks')}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="bookmark" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Bookmarks</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
            onPress={() => navigation.navigate('ScanHistory')}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="time" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Scan History</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Scans Section */}
        <View style={localStyles.sectionHeadingRow}>
          <Ionicons name="scan" size={25} color="#153c2a" style={{ marginRight: 10 }} />
          <Text style={[localStyles.sectionHeaderTitle, { color: '#153c2a' || theme?.text  }]}>Recent Scans</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.horizontalScrollBox}>
          {recentScansList.length > 0 ? (
              recentScansList.map((scan, index) => {
                  const scanDate = new Date(scan.createdAt);
                  const dateStr = scanDate.toLocaleDateString();
                  const timeStr = scanDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                      <TouchableOpacity 
                          key={scan._id || index} 
                          style={[localStyles.recentScanCard, { backgroundColor: theme?.card || '#FFF' }]}
                          onPress={() => setSelectedScan(scan)}
                      >
                          <Image source={{ uri: toAbsUrl(scan.imageUrl) }} style={localStyles.recentScanThumb} />
                          <View style={localStyles.recentScanInfo}>
                              <Text style={[localStyles.recentScanTitle, { color: theme?.text || '#000' }]} numberOfLines={1}>
                                  {scan.classification || 'Unknown'}
                              </Text>
                              <Text style={localStyles.recentScanSubtitle}>
                                  {Number(scan.confidence || 0).toFixed(1)}% Accuracy Score
                              </Text>
                              <Text style={localStyles.recentScanMeta}>
                                  {dateStr} • {timeStr}
                              </Text>
                          </View>
                          
                          <TouchableOpacity 
                              style={{ padding: 8, justifyContent: 'center' }} 
                              onPress={() => handleToggleBookmark(scan._id, 'scan')}
                          >
                            <Ionicons 
                                name={scan.bookmarked ? "bookmark" : "bookmark-outline"} 
                                size={22} 
                                color={scan.bookmarked ? "#153c2a" : "#64748B"} 
                            />
                          </TouchableOpacity>
                      </TouchableOpacity>
                  );
              })
          ) : (
              <View style={localStyles.emptyCardBox}>
                  <Text style={localStyles.emptyCardTitle}>No Recent Scans</Text>
                  <Text style={localStyles.emptyCardSub}>Your scanning history will appear here.</Text>
              </View>
          )}
        </ScrollView>

        {/* Latest Assessment Score Section */}
        <View style={localStyles.sectionHeadingRow}>
          <Ionicons name="bar-chart" size={25} color="#153c2a" style={{ marginRight: 10 }} />
          <Text style={[localStyles.sectionHeaderTitle, { color: '#153c2a' || theme?.text  }]}>Latest Assessment Score</Text>
        </View>

        {hasValidAssessment ? (
          <View style={[localStyles.assessmentScoreCard, { backgroundColor: theme?.card || '#FFFFFF' }]}>
            <View style={localStyles.assessmentContentLeft}>
              <View style={localStyles.quizBadgeTag}>
                <Text style={localStyles.quizBadgeTagText}>{latestQuiz?.title || 'Quiz'}</Text>
              </View>
              <Text style={localStyles.assessmentSubmittedText}>
                Submitted: {latestQuiz?.submittedAt ? new Date(latestQuiz.submittedAt).toLocaleDateString() : 'N/A'}
              </Text>
              <Text style={[localStyles.assessmentFeedbackText, { color: theme?.text || '#1A1A1A' }]}>
                {latestQuiz?.feedback || 'No feedback'}
              </Text>
            </View>
            <View style={localStyles.assessmentContentRight}>
              {latestQuiz.scorePending ? (
                <Text style={[localStyles.scoreFractionText, { color: '#D97706', fontSize: 16 }]}>Pending</Text>
              ) : (
                <Text style={[localStyles.scoreFractionText, { color: latestQuiz.percent >= 70 ? '#10B981' : '#EF4444' }]}>
                  {`${latestQuiz.score} / ${latestQuiz.total || 10}`}
                </Text>
              )}
              <TouchableOpacity onPress={() => navigation.navigate('Assessments')}>
                <Text style={localStyles.viewAllLinkText}>View all</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[localStyles.emptyAssessmentCard, { backgroundColor: theme?.card || '#FFFFFF' }]}>
            <Ionicons name="clipboard-outline" size={28} color="#153c2a" style={{ marginBottom: 6 }} />
            <Text style={[localStyles.emptyAssessmentTitle, { color: theme?.text || '#1A1A1A' }]}>No assessment taken yet</Text>
            <TouchableOpacity 
              style={localStyles.takeAssessmentBtn}
              onPress={() => navigation.navigate('Assessments')}
              activeOpacity={0.85}
            >
              <Text style={localStyles.takeAssessmentBtnText}>Take an assessment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recently Opened Lessons Section */}
        <View style={localStyles.sectionHeadingRow}>
          <Ionicons name="book" size={25} color="#153c2a" style={{ marginRight: 10 }} />
          <Text style={[localStyles.sectionHeaderTitle, { color: '#153c2a' || theme?.text  }]}>Recently Opened Lessons</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.horizontalScrollBox}>
          {recentLessonsList.length > 0 ? (
                recentLessonsList.map((lesson, index) => {
                    const isRemedial = lesson.type === 'remedial';
                    const modifierName = lesson.modifiedBy ? `${lesson.modifiedBy.fname} ${lesson.modifiedBy.lname}` : 'System';
                    const dateStr = new Date(lesson.lastAccessedAt || lesson.updatedAt || lesson.createdAt).toLocaleDateString();
                    const isBookmarked = bookmarks?.lessons?.includes(lesson._id);

                    let modNameRender = 'Instructor';
                    if (!isRemedial) {
                        const modId = getUserId(lesson.modifiedBy) || getUserId(lesson.createdBy);
                        const modUser = modId ? usersMap[String(modId)] : null;

                        if (modUser && modUser.fname) {
                            modNameRender = `${modUser.fname} ${modUser.lname}`.trim();
                        } else if (typeof lesson.modifiedBy === 'object' && lesson.modifiedBy?.fname) {
                            modNameRender = `${lesson.modifiedBy.fname} ${lesson.modifiedBy.lname}`.trim();
                        } else if (typeof lesson.createdBy === 'object' && lesson.createdBy?.fname) {
                            modNameRender = `${lesson.createdBy.fname} ${lesson.createdBy.lname}`.trim();
                        }
                    } else {
                        modNameRender = 'System';
                    }

                    return (
                        <TouchableOpacity 
                            key={lesson._id || index} 
                            style={[localStyles.lessonItemCard, { backgroundColor: theme?.card || '#FFF' }]}
                            onPress={() => navigation.navigate('LessonStudent', { 
                                lessonId: isRemedial ? null : lesson._id, 
                                personalizedLesson: isRemedial ? lesson : null 
                            })}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={[localStyles.lessonIconSmallBox, { backgroundColor: isRemedial ? '#FEF2F2' : '#F0F9F4', padding: 10 }]}>
                                    <Ionicons name={isRemedial ? "medical" : "book"} size={24} color={isRemedial ? "#EF4444" : "#153c2a"} />
                                </View>
                                
                                <TouchableOpacity 
                                    style={{ padding: 4 }} 
                                    onPress={() => handleToggleBookmark(lesson._id, 'lesson')}
                                >
                                  <Ionicons 
                                      name={isBookmarked ? "bookmark" : "bookmark-outline"} 
                                      size={22} 
                                      color={isBookmarked ? "#153c2a" : "#64748B"} 
                                  />
                                </TouchableOpacity>
                            </View>

                            <Text style={[localStyles.lessonCardTitle, { color: theme?.text || '#000', marginTop: 10 }]} numberOfLines={2}>
                                {lesson.title || 'Untitled Lesson'}
                            </Text>
                            
                            <Text style={localStyles.lessonCardSub}>
                                {isRemedial ? 'Personalized Remedial' : `Modified by ${modNameRender}`}
                            </Text>
                            <Text style={[localStyles.lessonCardSub, { fontSize: 11, marginTop: 4 }]}>
                                Last opened: {dateStr}
                            </Text>
                        </TouchableOpacity>
                    );
                })
            ) : (
                <View style={localStyles.emptyCardBox}>
                    <Text style={localStyles.emptyCardTitle}>No Recent Lessons</Text>
                    <Text style={localStyles.emptyCardSub}>Your lesson history will appear here.</Text>
                </View>
          )}
        </ScrollView>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={!!selectedScan} transparent={true} animationType="fade" onRequestClose={() => setSelectedScan(null)}>
          <View style={localStyles.fsModalBackground}>
              <View style={localStyles.fsModalHeader}>
                  <TouchableOpacity onPress={() => setSelectedScan(null)} style={localStyles.fsIconButton}>
                      <Ionicons name="close" size={28} color="#fff" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                      onPress={handleDownload} 
                      style={localStyles.fsIconButton}
                      disabled={isDownloading}
                  >
                      {isDownloading ? (
                          <ActivityIndicator color="#fff" size="small" />
                      ) : (
                          <Ionicons name="download-outline" size={26} color="#fff" />
                      )}
                  </TouchableOpacity>
              </View>

              {selectedScan && (
                  <View ref={printRef} collapsable={false} style={localStyles.exportCard}>
                      <View style={localStyles.exportBrandRow}>
                          <Ionicons name="scan-circle" size={24} color="#153c2a" />
                          <Text style={localStyles.exportBrandText}>MyphoLens AI Analysis</Text>
                      </View>
                      <Image 
                          source={{ uri: toAbsUrl(selectedScan.imageUrl) }} 
                          style={localStyles.exportImage} 
                      />
                      <View style={localStyles.exportData}>
                          <Text style={localStyles.exportTitle} numberOfLines={2}>{selectedScan.classification || 'Unknown'}</Text>
                          <Text style={localStyles.exportScore}>{Number(selectedScan.confidence || 0).toFixed(1)}% Confidence Match</Text>
                          <Text style={localStyles.exportDate}>Scanned on {new Date(selectedScan.createdAt).toLocaleString()}</Text>
                      </View>
                  </View>
              )}
          </View>
      </Modal>

      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalCardContainer, { height: '85%' }]}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitleText}>Calendar</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)} style={localStyles.closeModalBtn}>
                <Ionicons name="close" size={24} color="#153c2a" />
              </TouchableOpacity>
            </View>
            
            {/* Calendar Controls */}
            <View style={localStyles.calendarControlsRow}>
              <TouchableOpacity onPress={handlePrevMonth} style={localStyles.calendarNavBtn}>
                <Ionicons name="chevron-back" size={20} color="#153c2a" />
              </TouchableOpacity>
              <Text style={localStyles.calendarMonthText}>{MONTH_NAMES[calendarMonth]} {calendarYear}</Text>
              <TouchableOpacity onPress={handleNextMonth} style={localStyles.calendarNavBtn}>
                <Ionicons name="chevron-forward" size={20} color="#153c2a" />
              </TouchableOpacity>
            </View>

            {/* Grid */}
            {renderCalendarGrid()}

            {/* Legends */}
            {legendEntries.length > 0 && (
              <View style={localStyles.legendContainer}>
                {legendEntries.map((legend, idx) => (
                  <View key={idx} style={localStyles.legendItem}>
                    <View style={[localStyles.legendDot, { backgroundColor: legend.color }]} />
                    <Text style={localStyles.legendText}>{legend.type}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Events for Selected Date */}
            <View style={localStyles.selectedEventsContainer}>
              <Text style={localStyles.selectedDateTitle}>
                Events on {new Date(selectedDateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
              {selectedEvents.length === 0 ? (
                <Text style={localStyles.emptyText}>No events scheduled for this day.</Text>
              ) : (
                <FlatList
                  data={selectedEvents}
                  keyExtractor={(item) => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={renderEventItem}
                  removeClippedSubviews={true}
                />
              )}
            </View>
            
          </View>
        </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 10, backgroundColor: 'transparent' },
  headerTitle: { fontSize: 25, fontWeight: '600', color: '#153c2a' },
  notificationBell: { position: 'relative', width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#EAEFEB', justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', right: -4, top: -4, backgroundColor: 'red', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 10 },
  welcomeBanner: { backgroundColor: '#153c2a', borderRadius: 10, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  welcomeTextContainer: { flex: 1, paddingRight: 12 },
  welcomeSubText: { fontSize: 23, color: '#ffffff', fontWeight: '400', marginBottom: 4 },
  welcomeUserName: { fontSize: 25, fontWeight: '900', color: '#FFFFFF' },
  welcomeAvatarCircle: { width: 75, height: 75, borderRadius: 37.5, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 3, borderColor: '#FFF' },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 37.5 },
  avatarInitials: { fontSize: 30, fontWeight: '900', color: '#153c2a' },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 5 },
  sectionHeaderTitle: { fontSize: 20, fontWeight: '700' },
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
  quickLinkCard: { width: (width - 40 - 20) / 3, borderRadius: 10, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4 },
  quickLinkIconBox: { width: 70, height: 70, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLinkText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  horizontalScrollBox: { paddingVertical: 4, marginBottom: 16 },
  recentScanCard: { width: 300, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1, marginBottom: 20 },
  recentScanThumb: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#E2E8F0', marginRight: 12 },
  recentScanInfo: { flex: 1 },
  recentScanTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  recentScanSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  recentScanMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 4 },
  emptyCardBox: { width: width - 40, borderRadius: 10, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', marginBottom: 20 },
  emptyCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  emptyCardSub: { fontSize: 13, color: '#64748B' },
  assessmentScoreCard: { borderRadius: 10, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  emptyAssessmentCard: { borderRadius: 10, padding: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 30, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', elevation: 1 },
  emptyAssessmentTitle: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  takeAssessmentBtn: { backgroundColor: '#153c2a', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', elevation: 2 },
  takeAssessmentBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  assessmentContentLeft: { flex: 1, paddingRight: 10 },
  quizBadgeTag: { backgroundColor: '#153c2a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 6 },
  quizBadgeTagText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  assessmentSubmittedText: { fontSize: 15, color: '#64748B', marginBottom: 4, fontWeight: '500' },
  assessmentFeedbackText: { fontSize: 13, fontWeight: '600' },
  assessmentContentRight: { alignItems: 'flex-end' },
  scoreFractionText: { fontSize: 25, fontWeight: '900', marginBottom: 2 },
  viewAllLinkText: { fontSize: 13, fontWeight: '800', color: '#153c2a' },
  lessonItemCard: { width: 250, borderRadius: 10, padding: 14, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  lessonIconSmallBox: { borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  lessonCardTitle: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  lessonCardSub: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCardContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitleText: { fontSize: 25, fontWeight: '900', color: '#153c2a' },
  closeBtn: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
  closeModalBtn: { padding: 4, backgroundColor: '#F1F5F9', borderRadius: 20 },
  
  fsModalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  fsModalHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
  fsIconButton: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 30 },
  exportCard: { backgroundColor: '#FFFFFF', width: '85%', borderRadius: 24, overflow: 'hidden', padding: 20, alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15 },
  exportBrandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 6 },
  exportBrandText: { fontSize: 14, fontWeight: '800', color: '#153c2a', textTransform: 'uppercase', letterSpacing: 0.5 },
  exportImage: { width: '100%', height: 320, borderRadius: 16, resizeMode: 'cover', backgroundColor: '#F1F5F9', marginBottom: 20 },
  exportData: { width: '100%', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  exportTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginBottom: 6, textAlign: 'center' },
  exportScore: { fontSize: 15, fontWeight: '800', color: '#10B981', marginBottom: 6 },
  exportDate: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  calendarControlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  calendarNavBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 },
  calendarMonthText: { fontSize: 18, fontWeight: '800', color: '#153c2a' },
  daysOfWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dayOfWeekText: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#64748B' },
  daysGridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: 50, justifyContent: 'flex-start', alignItems: 'center', marginVertical: 2, borderRadius: 10, paddingTop: 8 },
  cellSelected: { backgroundColor: '#153c2a' },
  dayText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  cellTextSelected: { color: '#FFFFFF', fontWeight: '900' },
  dotsRow: { flexDirection: 'row', marginTop: 4, gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },
  selectedEventsContainer: { marginTop: 20, flex: 1 },
  selectedDateTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 10 },
  eventItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  eventColorIndicator: { width: 12, height: 12, borderRadius: 6, marginRight: 14 },
  eventContent: { flex: 1, paddingRight: 10 },
  eventTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  eventDate: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  eventTypeBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  eventTypeText: { fontSize: 9, fontWeight: '900', color: '#64748B', textTransform: 'uppercase' },
  emptyText: { textAlign: 'center', color: '#64748B', marginVertical: 10, fontStyle: 'italic' }
});