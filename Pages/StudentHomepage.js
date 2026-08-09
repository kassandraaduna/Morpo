import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, StyleSheet, Platform, StatusBar, Dimensions, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import api, { toAbsUrl } from './src/services/api';
import { ThemeContext } from './src/context/ThemeContext';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { toastError, toastSuccess } from './src/components/ToastMsg';

const { width } = Dimensions.get('window');

const getInitials = (name) => {
  if (!name) return 'S';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
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
  const { theme } = useContext(ThemeContext);
  const printRef = useRef();

  const loadDashboardData = async () => { 
        try { 
            setLoading(true);
            const rawUser = await AsyncStorage.getItem('user'); 
            if (!rawUser) return; 
            const currentUser = JSON.parse(rawUser); 
            setUser(currentUser);
            
            // Fetch necessary dashboard data in parallel
            const [usersRes, syRes, lessonsRes, remedialRes, scansRes, bookmarksRaw] = await Promise.all([
                api.get('/admin/users').catch(() => api.get('/getMed').catch(() => ({ data: [] }))), // Fallback routing for users
                api.get('/admin/academic-settings/school-years').catch(() => ({ data: {} })),
                api.get('/lessons').catch(() => ({ data: { data: [] } })),
                api.get(`/ai/personalized-lessons/${currentUser._id}`).catch(() => ({ data: { data: [] } })),
                api.get(`/scan/history/${currentUser._id}`).catch(() => ({ data: { data: [] } })),
                AsyncStorage.getItem('studentBookmarks_v1').catch(() => null)
            ]);

            if (bookmarksRaw) setBookmarks(JSON.parse(bookmarksRaw));

            // 1. Extract Active School Year and Term Context
            const syContext = syRes.data?.context || {};
            const activeSyId = syContext.activeSchoolYearId;
            const activeTermKey = syContext.activeTermKey;

            // 2. Identify Instructors actively assigned to the student's Year Level & Section for the active Term
            const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
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

            // 3. Filter normal lessons: Must not be archived AND must be uploaded by an assigned instructor
            const rawLessons = lessonsRes.data?.data || [];
            const validLessons = rawLessons.filter(l => {
                const creatorId = typeof l.createdBy === 'object' ? l.createdBy?._id : l.createdBy;
                return !l.isArchived && assignedInstructorIds.includes(String(creatorId));
            });

            // 4. Combine with personalized remedial lessons
            const rawRemedial = remedialRes.data?.data || [];
            const combinedLessons = [
                ...validLessons.map(l => ({ ...l, type: 'normal' })),
                ...rawRemedial.map(l => ({ ...l, type: 'remedial', title: `Remedial: ${l.topic}`, updatedAt: l.createdAt }))
            ];

            // 5. Sort by most recent activity
            combinedLessons.sort((a, b) => {
                const dateA = new Date(a.lastAccessedAt || a.updatedAt || a.createdAt).getTime();
                const dateB = new Date(b.lastAccessedAt || b.updatedAt || b.createdAt).getTime();
                return dateB - dateA;
            });

            setSuggestedLessons(combinedLessons); 
            setScans(scansRes.data?.data || []);
            setLoading(false);
        } catch (error) {
            console.error("Dashboard Fetch Error:", error);
            setLoading(false);
        }
    };

  const handleToggleBookmark = async (itemId, type) => {
        try {
            if (type === 'scan') {
                // Handle Scan Bookmarking via Backend API
                const res = await api.put(`/scan-bookmark/${itemId}`);
                const updated = res.data.data;
                
                // Update local state to reflect UI change instantly
                setScans(prev => prev.map(s => s._id === itemId ? { ...s, bookmarked: updated.bookmarked } : s));
                
                if (updated.bookmarked) {
                    toastSuccess('Scan saved to Bookmarks');
                } else {
                    toastSuccess('Scan removed from Bookmarks');
                }
                
            } else if (type === 'lesson') {
                // Handle Lesson Bookmarking via Local Storage
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
                await AsyncStorage.setItem('studentBookmarks_v1', JSON.stringify(newBookmarks));
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

  useEffect(() => {
    loadDashboardData();
    const unsubscribe = navigation.addListener('focus', loadDashboardData);
    return unsubscribe;
  }, [navigation]);

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

  // Check safely if latestQuiz actually contains valid metrics
  const hasValidAssessment = latestQuiz && latestQuiz.score !== undefined && latestQuiz.score !== null;

  return (
    <View style={[localStyles.container, { backgroundColor: theme?.bg || '#F8F9FA' }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      {/* Top Header Row */}
      <View style={localStyles.topHeaderBar}>
        <Text style={[localStyles.headerTitle, { color: '#153c2a' || theme?.text }]}>Home</Text>
        <TouchableOpacity 
          style={localStyles.notificationBell} 
          onPress={() => navigation.navigate('Bookmarks', { initialTab: 'Notifications' })}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications" size={22} color="#153c2a" />
        </TouchableOpacity>
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
              <Image source={{ uri: toAbsUrl(user.avatar) }} style={localStyles.avatarImage} />
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
            onPress={() => navigation.navigate('Learn', { initialTab: 'lessons' })}
            activeOpacity={0.8}
          >
            <View style={localStyles.quickLinkIconBox}>
              <Ionicons name="book" size={50} color="#153c2a" />
            </View>
            <Text style={[localStyles.quickLinkText, { color: theme?.text || '#1A1A1A' }]}>Lessons</Text>
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
                                  {Number(scan.confidence).toFixed(1)}% Accuracy Score
                              </Text>
                              {/* ADDED DATE AND TIME */}
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
              <Text style={[localStyles.scoreFractionText, { color: theme?.text || '#1A1A1A' }]}>
                {`${latestQuiz.score} / ${latestQuiz.total || 10}`}
              </Text>
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
                                
                                {/* NEW: LESSON BOOKMARK BUTTON */}
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
                                {isRemedial ? 'Personalized Remedial' : `Modified by ${modifierName}`}
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

      <Modal visible={!!selectedScan} transparent={true} animationType="fade">
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalContent}>
                        <TouchableOpacity onPress={() => setSelectedScan(null)} style={localStyles.closeBtn}>
                            <Ionicons name="close-circle" size={32} color="#153c2a" />
                        </TouchableOpacity>
                        
                          {selectedScan && (
                            <>
                                <View 
                                    ref={printRef} 
                                    collapsable={false} 
                                    style={localStyles.printContainer}
                                >
                                    <Image 
                                        source={{ uri: toAbsUrl(selectedScan.imageUrl) }} 
                                        style={localStyles.fullImage} 
                                        resizeMode="contain" 
                                    />
                                    
                                    <View style={localStyles.metadataBox}>
                                        <Text style={localStyles.metaTitle}>{selectedScan.classification}</Text>
                                        <Text style={localStyles.metaSub}>{Number(selectedScan.confidence).toFixed(1)}% Confidence</Text>
                                        <Text style={localStyles.metaSub}>{new Date(selectedScan.createdAt).toLocaleString()}</Text>
                                    </View>
                                </View>
                                
                                <TouchableOpacity 
                                    style={localStyles.downloadBtn} 
                                    onPress={handleDownload} // Removed (selectedScan) parameter
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="download-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={localStyles.downloadBtnText}>Download Image</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
      </Modal>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  notificationBell: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#EAEFEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
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
    color: '#FFFFFF',
  },
  welcomeAvatarCircle: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '900',
    color: '#153c2a',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 5,
  },
  sectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickLinkCard: {
    width: (width - 40 - 20) / 3,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  quickLinkIconBox: {
    width: 70,
    height: 70,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLinkText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  horizontalScrollBox: {
    paddingVertical: 4,
    marginBottom: 16,
  },
  recentScanCard: {
    width: 300,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    marginBottom: 20,
  },
  recentScanThumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    marginRight: 12,
  },
  recentScanInfo: {
    flex: 1,
  },
  recentScanTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  recentScanSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyCardBox: {
    width: width - 40,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  emptyCardSub: {
    fontSize: 13,
    color: '#64748B',
  },
  assessmentScoreCard: {
    borderRadius: 10,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  emptyAssessmentCard: {
    borderRadius: 10,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    elevation: 1,
  },
  emptyAssessmentTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  takeAssessmentBtn: {
    backgroundColor: '#153c2a',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  takeAssessmentBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  assessmentContentLeft: {
    flex: 1,
    paddingRight: 10,
  },
  quizBadgeTag: {
    backgroundColor: '#153c2a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  quizBadgeTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  assessmentSubmittedText: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  assessmentFeedbackText: {
    fontSize: 13,
    fontWeight: '600',
  },
  assessmentContentRight: {
    alignItems: 'flex-end',
  },
  scoreFractionText: {
    fontSize: 25,
    fontWeight: '900',
    marginBottom: 2,
  },
  viewAllLinkText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#153c2a',
  },
  lessonItemCard: {
    width: 250,
    borderRadius: 10,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  lessonIconSmallBox: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  lessonCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  lessonCardSub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
    recentScanMeta: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', elevation: 10, position: 'relative' },
    closeBtn: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
    fullImage: { width: '100%', height: 300, borderRadius: 15, marginBottom: 20, backgroundColor: '#f1f5f9' },
    metadataBox: { alignItems: 'center', marginBottom: 20 },
    metaTitle: { fontSize: 22, fontWeight: '900', color: '#153c2a', marginBottom: 4 },
    metaSub: { fontSize: 14, color: '#64748B', fontWeight: '600', marginBottom: 2 },
    downloadBtn: { flexDirection: 'row', backgroundColor: '#153c2a', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', width: '100%', justifyContent: 'center' },
    downloadBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
    printContainer: { width: '100%', backgroundColor: '#ffffff', padding: 10, borderRadius: 15, alignItems: 'center' },
});