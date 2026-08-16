import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  Dimensions, 
  ActivityIndicator,
  Modal,
  FlatList, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';
import api, { toAbsUrl } from './src/services/api';

const { width } = Dimensions.get('window');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getInitials = (name) => {
  if (!name) return 'I';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const getAvatarUri = (url, u) => {
  if (!url) return null;
  if (url.startsWith('data:image') || url.startsWith('file:')) return url;
  return `${toAbsUrl(url)}?v=${u?.updatedAt || '1'}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const extractValue = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    return String(val.section || val.name || val.title || val._id || '').trim();
  }
  return String(val).trim();
};

const normalizeSection = (value) => extractValue(value).replace(/\s+/g, ' ').toUpperCase();

export default function InstructorHomepage({ navigation }) {
  const { theme } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showCalendar, setShowCalendar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [stats, setStats] = useState({ sectionsAssigned: 0, totalStudents: 0, avgScore: 0 });
  const [performance, setPerformance] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);

  // Calendar State
  const today = new Date();
  const initDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth());
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [selectedDateStr, setSelectedDateStr] = useState(initDateStr);

  const loadInstructorData = async () => {
    try {
      setLoading(true);
      const rawUser = await AsyncStorage.getItem('user');
      const token = await AsyncStorage.getItem('token'); 
      
      if (!rawUser) return;
      const currentUser = JSON.parse(rawUser);
      setUser(currentUser);
      
      const config = {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      };
      
      let fetchedStudents = [];
      let relevantScores = [];
      let generatedNotifs = [];
      let plottedEvents = [];

      const assignments = currentUser.instructorAssignments || [];
      const fallbackArr = Array.isArray(currentUser.assignedSections) ? currentUser.assignedSections : [];
      const fallbackStr = currentUser.section ? [currentUser.section] : [];
      
      const allSectionsRaw = [
        ...assignments.map(a => typeof a === 'object' ? a.section : a),
        ...fallbackArr,
        ...fallbackStr
      ];
      
      const uniqueSections = new Set(allSectionsRaw.map(normalizeSection).filter(Boolean));
      const sectionsAssigned = uniqueSections.size;

      try {
        const res = await api.get('/admin/users', config);
        const allUsers = Array.isArray(res.data) ? res.data : (res.data?.users || []);
        
        fetchedStudents = allUsers.filter(u => {
          const roleStr = extractValue(u.role);
          const isStudent = roleStr.toLowerCase() === 'student' || roleStr.toLowerCase() === 'user';
          const studentSection = normalizeSection(u.section);
          return isStudent && uniqueSections.has(studentSection);
        });
      } catch (err) {
        console.warn("Failed to fetch students from /admin/users:", err.message);
      }

      const totalStudents = fetchedStudents.length;

      if (totalStudents > 0) {
        try {
          const scorePromises = fetchedStudents.map(student => 
            api.get(`/practice/history/${student._id}`, config)
                .catch(() => api.get(`/assessments/history/${student._id}`, config))
                .catch(() => ({ data: [] })) 
          );

          const historyResponses = await Promise.all(scorePromises);
          
          historyResponses.forEach((res, index) => {
            const studentHistory = res.data?.history || res.data || [];
            const studentId = fetchedStudents[index]._id;
            
            studentHistory.forEach(attempt => {
              relevantScores.push({
                ...attempt,
                studentId: studentId,
                score: attempt.score || attempt.result || 0,
                createdAt: attempt.createdAt || new Date().toISOString()
              });
            });
          });
        } catch (err) {
          console.warn("Failed to compile individual student histories.");
        }
      }

      const overallAvgScore = relevantScores.length > 0 
        ? relevantScores.reduce((acc, curr) => acc + (curr.score || 0), 0) / relevantScores.length 
        : 0;

      setStats({ sectionsAssigned, totalStudents, avgScore: overallAvgScore });

      const performanceData = fetchedStudents.map(student => {
        const studentSubmissions = relevantScores.filter(s => s.studentId === student._id);
        const studentAvg = studentSubmissions.length > 0
          ? studentSubmissions.reduce((acc, curr) => acc + (curr.score || 0), 0) / studentSubmissions.length
          : 0;
          
        return {
          _id: student._id,
          name: `${student.fname || ''} ${student.lname || ''}`.trim() || 'Unknown Student',
          year: student.yearLevel || 'N/A',
          section: extractValue(student.section) || 'N/A',
          score: Math.round(studentAvg)
        };
      });

      setPerformance(performanceData);

      if (relevantScores.length > 0) {
        const recentSubmissions = relevantScores
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 3);

        recentSubmissions.forEach(sub => {
          const student = fetchedStudents.find(s => s._id === sub.studentId);
          if (student) {
            generatedNotifs.push({
              _id: sub._id || Math.random().toString(),
              type: 'assessment',
              message: `${student.fname} submitted a practice session (Score: ${Math.round(sub.score)}%)`,
              createdAt: sub.createdAt,
              isRead: false
            });
          }
        });
      }

      try {
        const [calRes, dataRes, assessRes] = await Promise.all([
          api.get('/calendar/events', config).catch(() => ({ data: [] })),
          api.get('/datasets', config).catch(() => ({ data: [] })),
          api.get('/assessments', { ...config, params: { instructorId: currentUser._id } }).catch(() => ({ data: [] }))
        ]);

        const events = calRes.data?.events || calRes.data || [];
        events.forEach(ev => {
          if(ev.date) {
            plottedEvents.push({
              id: ev._id || Math.random().toString(),
              title: ev.title,
              date: new Date(ev.date),
              type: ev.type || 'event',
              color: ev.color || '#153c2a'
            });
          }
        });

        if (events.length > 0) {
          generatedNotifs.push({
            _id: `cal-${events[0]._id || Math.random()}`,
            type: 'calendar',
            message: `New calendar event added: ${events[0].title || 'Update'}`,
            createdAt: events[0].createdAt || new Date().toISOString(),
            isRead: false
          });
        }

        const assessmentsData = assessRes.data?.data || assessRes.data || [];
        assessmentsData.forEach(a => {
          if(a.deadlineAt || a.closesAt) {
            plottedEvents.push({
              id: `assess-${a._id}`,
              title: `${a.title} Due`,
              date: new Date(a.deadlineAt || a.closesAt),
              type: 'assessment',
              color: '#EF4444' 
            });
          }
        });

        plottedEvents.sort((a, b) => a.date - b.date);
        setCalendarEvents(plottedEvents);

        const datasets = dataRes.data?.datasets || dataRes.data?.data || [];
        if (datasets.length > 0) {
          generatedNotifs.push({
            _id: `data-${datasets[0]._id || Math.random()}`,
            type: 'dataset',
            message: `New AI Scan added to Dataset Library.`,
            createdAt: datasets[0].createdAt || new Date().toISOString(),
            isRead: false
          });
        }
      } catch (err) {
        console.log("Skipping generic notifications (Endpoints missing)");
      }

      generatedNotifs.push({
        _id: 'sys-1',
        type: 'assignment',
        message: `You are currently handling ${sectionsAssigned} section(s).`,
        createdAt: new Date().toISOString(),
        isRead: true
      });

      generatedNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(generatedNotifs);

    } catch (error) {
      console.error("Critical error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstructorData();
    const unsubscribe = navigation.addListener('focus', loadInstructorData);
    return unsubscribe;
  }, [navigation]);

  const renderNotifItem = useCallback(({ item }) => (
    <View style={localStyles.notifItem}>
      <View style={[localStyles.notifIconBox, !item.isRead && { backgroundColor: '#C5DEC9' }]}>
        <Ionicons 
          name={item.type === 'dataset' ? 'cube' : item.type === 'calendar' ? 'calendar' : item.type === 'assessment' ? 'clipboard' : 'notifications'} 
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

  // Calendar Logic
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

  if (!user || loading) {
    return (
      <View style={[localStyles.centered, { backgroundColor: theme?.bg || '#F4F7F6' }]}>
        <ActivityIndicator size="large" color="#153c2a" />
      </View>
    );
  }

  const fullName = `${user.fname || ''} ${user.lname || ''}`.trim() || 'Instructor';
  const unreadNotifs = notifications.filter(n => !n.isRead).length;
  const selectedEvents = getSelectedEvents();
  
  // Extract Dynamic Legends
  const legendsMap = {};
  calendarEvents.forEach(e => { legendsMap[e.type] = e.color; });
  const legendEntries = Object.keys(legendsMap).map(type => ({ type, color: legendsMap[type] }));

  return (
    <View style={[localStyles.container, { backgroundColor: theme?.bg || '#F4F7F6' }]}>

      <View style={localStyles.topHeaderBar}>
        <Text style={localStyles.headerTitle}>Home</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          
          <TouchableOpacity onPress={() => setShowCalendar(true)} style={[localStyles.bellContainer, { marginRight: 18 }]}>
            <Ionicons name="calendar" size={28} color="#153c2a" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowNotifications(true)} style={localStyles.bellContainer}>
            <Ionicons name="notifications" size={28} color="#153c2a" />
            {unreadNotifs > 0 && (
              <View style={localStyles.badge}>
                <Text style={localStyles.badgeText}>{unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
          
        </View>
      </View>

      <ScrollView contentContainerStyle={localStyles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        <View style={localStyles.welcomeBanner}>
          <View style={localStyles.welcomeTextContainer}>
            <Text style={localStyles.welcomeSubText}>Welcome back,</Text>
            <Text style={localStyles.welcomeUserName}>{fullName}</Text>
          </View>
          <View style={localStyles.welcomeAvatarCircle}>
            {user?.avatar ? (
              <Image source={{ uri: getAvatarUri(user.avatar, user) }} style={localStyles.avatarImage} />
            ) : (
              <Text style={localStyles.avatarInitials}>{getInitials(fullName)}</Text>
            )}
          </View>
        </View>

        <View style={localStyles.statsContainer}>
          <View style={localStyles.statCard}>
            <View style={localStyles.statLeft}>
              <View style={localStyles.statIconBox}>
                <Ionicons name="layers" size={20} color="#153c2a" />
              </View>
              <Text style={localStyles.statLabel}>Sections Assigned</Text>
            </View>
            <Text style={localStyles.statNumber}>{stats.sectionsAssigned}</Text>
          </View>

          <View style={localStyles.statCard}>
            <View style={localStyles.statLeft}>
              <View style={localStyles.statIconBox}>
                <Ionicons name="people" size={20} color="#153c2a" />
              </View>
              <Text style={localStyles.statLabel}>Total Students</Text>
            </View>
            <Text style={localStyles.statNumber}>{stats.totalStudents}</Text>
          </View>

          <View style={localStyles.statCard}>
            <View style={localStyles.statLeft}>
              <View style={localStyles.statIconBox}>
                <Ionicons name="bar-chart" size={20} color="#153c2a" />
              </View>
              <Text style={localStyles.statLabel}>Avg Score</Text>
            </View>
            <Text style={localStyles.statNumber}>{stats.avgScore.toFixed(1)}%</Text>
          </View>
        </View>

        <View style={localStyles.sectionContainer}>
          <View style={localStyles.sectionHeadingRow}>
            <Ionicons name="link" size={20} color="#153c2a" />
            <Text style={localStyles.sectionHeaderTitle}>Quick Links</Text>
          </View>
          <View style={localStyles.quickLinksGrid}>
            <TouchableOpacity 
              style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
              onPress={() => navigation.navigate('UploadLesson')}
              activeOpacity={0.8}
            >
              <View style={localStyles.quickLinkIconBox}>
                <Ionicons name="add" size={50} color="#153c2a" />
              </View>
              <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Upload Lesson</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
              onPress={() => navigation.navigate('Learn', { initialTab: 'assessments' })}
              activeOpacity={0.8}
            >
              <View style={localStyles.quickLinkIconBox}>
                <Ionicons name="clipboard" size={50} color="#153c2a" />
              </View>
              <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Assessments</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
              onPress={() => navigation.navigate('Learn', { initialTab: 'models' })}
              activeOpacity={0.8}
            >
              <View style={localStyles.quickLinkIconBox}>
                <Ionicons name="cube" size={50} color="#153c2a" />
              </View>
              <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>3D Models</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
              onPress={() => navigation.navigate('StudentMonitoring')}
              activeOpacity={0.8}
            >
              <View style={localStyles.quickLinkIconBox}>
                <Ionicons name="analytics" size={50} color="#153c2a" />
              </View>
              <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Student Monitoring</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[localStyles.quickLinkCard, { backgroundColor: theme?.card || '#FFFFFF' }]} 
              onPress={() => navigation.navigate('DatasetLibrary')}
              activeOpacity={0.8}
            >
              <View style={localStyles.quickLinkIconBox}>
                <Ionicons name="images" size={50} color="#153c2a" />
              </View>
              <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Dataset Library</Text>
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
          </View>
        </View>

        <View style={localStyles.sectionContainer}>
          <View style={[localStyles.sectionHeadingRow, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="bar-chart" size={20} color="#153c2a" />
              <Text style={localStyles.sectionHeaderTitle}>Student Performance Overview</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('StudentMonitoring')}>
              <Text style={localStyles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {performance.length === 0 ? (
            <Text style={localStyles.emptyText}>No students assigned or no data available.</Text>
          ) : (
            performance.map((student, index) => (
              <View key={index} style={localStyles.performanceCard}>
                <View style={localStyles.perfAvatarCircle}>
                  <Text style={localStyles.perfAvatarInitials}>{getInitials(student.name)}</Text>
                </View>
                <View style={localStyles.perfInfo}>
                  <Text style={localStyles.perfName}>{student.name}</Text>
                  <Text style={localStyles.perfMeta}>{student.year} | {student.section}</Text>
                  <View style={localStyles.progressBarBg}>
                    <View style={[localStyles.progressBarFill, { width: `${Math.min(student.score || 0, 100)}%` }]} />
                  </View>
                </View>
                <Text style={localStyles.perfScore}>{student.score}%</Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* NOTIFICATIONS MODAL */}
      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalCard}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)} style={localStyles.closeBtn}>
                <Ionicons name="close" size={24} color="#153c2a" />
              </TouchableOpacity>
            </View>
            
            {notifications.length === 0 ? (
              <Text style={localStyles.emptyText}>You have no new notifications.</Text>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item, index) => item._id || index.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={renderNotifItem}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalCard, { height: '85%' }]}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Calendar</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)} style={localStyles.closeBtn}>
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
  container: { 
    flex: 1 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  topHeaderBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 40, 
    paddingBottom: 10,
    backgroundColor: 'transparent', 
  },
  headerTitle: { 
    fontSize: 25, 
    fontWeight: '600', 
    color: '#153c2a' 
  },
  bellContainer: { 
    position: 'relative' 
  },
  badge: { 
    position: 'absolute', 
    right: -4, 
    top: -4, 
    backgroundColor: 'red', 
    borderRadius: 10, 
    width: 20, 
    height: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  badgeText: { 
    color: 'white', 
    fontSize: 10, 
    fontWeight: 'bold' 
  },
  scrollContainer: { 
    paddingHorizontal: 20, 
    paddingBottom: 40 
  },
  welcomeBanner: {
    backgroundColor: '#153c2a',
    borderRadius: 10,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  welcomeTextContainer: { 
    flex: 1,
    paddingRight: 12, 
  },
  welcomeSubText: { 
    fontSize: 23,
    color: '#ffffff',
    fontWeight: '400',
    marginBottom: 4,
  },
  welcomeUserName: { 
    fontSize: 25, 
    fontWeight: '900', 
    color: '#FFFFFF' 
  },
  welcomeAvatarCircle: { 
    width: 75,
    height: 75,
    borderRadius: 37.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden', 
    borderWidth:3, borderColor: '#FFF',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFF',
  },
  
  statsContainer: { 
    marginBottom: 20 
  },
  statCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    padding: 18, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#F1F5F9' 
  },
  statLeft: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  statIconBox: { 
    width: 40, 
    height: 40, 
    borderRadius: 10, 
    backgroundColor: '#F1F5F9', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  statLabel: { 
    fontSize: 15, 
    color: '#000', 
    fontWeight: '600' 
  },
  statNumber: { 
    fontSize: 25, 
    fontWeight: '900', 
    color: '#153c2a' 
  },
  
  sectionContainer: {
    borderRadius: 10, 
    padding: 16, 
    marginBottom: 20,
  },
  sectionHeadingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  sectionHeaderTitle: { 
    fontSize: 16, 
    fontWeight: '900', 
    color: '#000', 
    marginLeft: 8 
  },
  viewAllText: { 
    fontSize: 13, 
    fontWeight: '800', 
    color: '#153c2a' 
  }, 
  
  quickLinksGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' },
  quickLinkCard: { 
    width: (width - 40 - 32 - 16) / 3, 
    backgroundColor: '#F4F7F6', 
    borderRadius: 10, 
    paddingVertical: 15, 
    paddingHorizontal: 5, 
    alignItems: 'center', 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  quickLinkText: { 
    fontSize: 13, 
    fontWeight: '700', 
    textAlign: 'center' 
  },

  performanceCard: { 
    backgroundColor: '#F4F7F6', 
    borderRadius: 10, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#E2E8F0' 
  },
  perfAvatarCircle: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#C5DEC9', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  perfAvatarInitials: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#153c2a' 
  },
  perfInfo: { 
    flex: 1, 
    marginRight: 10 
  },
  perfName: { 
    fontSize: 18, 
    fontWeight: '800',
  },
  perfMeta: { 
    fontSize: 13, 
    color: '#000', 
    fontWeight: '600', 
    marginTop: 2, 
    marginBottom: 6 
  },
  progressBarBg: { 
    height: 6, 
    backgroundColor: '#D1D5DB', 
    borderRadius: 3, 
    width: '100%' 
  },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: '#10B981', 
    borderRadius: 3 
  },
  perfScore: { 
    fontSize: 15, 
    fontWeight: '900', 
    color: '#10B981' 
  },
  emptyText: { 
    textAlign: 'center', 
    color: '#64748B', 
    marginVertical: 10, 
    fontStyle: 'italic' 
  },
  
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalCard: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24, 
    maxHeight: '85%' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  modalTitle: { 
    fontSize: 25, 
    fontWeight: '900', 
    color: '#153c2a' 
  },
  closeBtn: { 
    padding: 4, 
    backgroundColor: '#F1F5F9', 
    borderRadius: 20 
  },

  notifItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  notifIconBox: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#E7F5EE', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 16 
  },
  notifContent: { 
    flex: 1 
  },
  notifText: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#1E293B', 
    lineHeight: 20 
  },
  notifTime: { 
    fontSize: 13, 
    color: '#94A3B8', 
    fontWeight: '500', 
    marginTop: 4 
  },

  // Event List Item below Calendar
  eventItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14,
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9' 
  },
  eventColorIndicator: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    marginRight: 14 
  },
  eventContent: { 
    flex: 1, 
    paddingRight: 10 
  },
  eventTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#1E293B', 
    marginBottom: 4 
  },
  eventDate: { 
    fontSize: 13, 
    color: '#64748B', 
    fontWeight: '600' 
  },
  eventTypeBadge: { 
    backgroundColor: '#F1F5F9', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6 
  },
  eventTypeText: { 
    fontSize: 9, 
    fontWeight: '900', 
    color: '#64748B', 
    textTransform: 'uppercase' 
  },

  // Calendar Grid Styles
  calendarControlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  calendarNavBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 },
  calendarMonthText: { fontSize: 18, fontWeight: '800', color: '#153c2a' },
  daysOfWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dayOfWeekText: { width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '800', color: '#64748B' },
  daysGridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { 
    width: '14.28%', 
    height: 50, 
    justifyContent: 'flex-start', 
    alignItems: 'center', 
    marginVertical: 2, 
    borderRadius: 10, 
    paddingTop: 8 
  },
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
});