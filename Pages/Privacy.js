import React, { useContext } from 'react';
import { 
    View, Text, ScrollView, TouchableOpacity, 
    StyleSheet, Platform, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';

export default function Privacy({ navigation }) {
    const { theme } = useContext(ThemeContext);

    // Reusable component for each privacy section
    const Section = ({ title, content }) => (
        <View style={localStyles.section}>
            <Text style={[localStyles.sectionTitle, { color: theme?.text || '#1E293B' }]}>
                {title}
            </Text>
            <Text style={[localStyles.sectionText, { color: theme?.subText || '#64748B' }]}>
                {content}
            </Text>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: theme?.bg || '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor="#153c2a" />

            {/* HEADER */}
            <View style={localStyles.header}>
                <View style={localStyles.headerTopRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backBtn}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={localStyles.headerTextContainer}>
                        <Text style={localStyles.headerTitle}>Privacy Policy</Text>
                    </View>
                </View>
            </View>

            {/* PRIVACY CONTENT */}
            <ScrollView contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[localStyles.card, { backgroundColor: theme?.card || '#FFF' }]}>
                    
                    <View style={localStyles.lastUpdatedContainer}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                        <Text style={localStyles.lastUpdatedText}>Last Updated: August 2026</Text>
                    </View>
                    
                    <Section 
                        title="1. Information We Collect" 
                        content="When you register for MyphoLens, we collect basic profile information including your name, email address, mobile number, date of birth, gender, and academic role (e.g., Student, Instructor). For students, we also track your assigned section and year level to properly route instructor assignments." 
                    />
                    
                    <Section 
                        title="2. AI Scan Data & Retention" 
                        content="Images uploaded to the AI scanner are processed to classify items and recommend relevant lessons. Bookmarked sequence matrices and scans are kept safe in your profile. However, to protect your privacy and reduce server load, all non-bookmarked items and scan history are cleared automatically after 30 days (1 month from the classification date)." 
                    />
                    
                    <Section 
                        title="3. Academic Assessment Data" 
                        content="When you take an official assessment assigned by an instructor, your answers, completion time, and final score are recorded and shared with your instructor through the Student Monitoring dashboar. However, practice test scores are graded locally on your device and are not recorded in your official assessment history." 
                    />
                    
                    <Section 
                        title="4. Account Inactivity" 
                        content="To maintain system security and data hygiene, user accounts that remain inactive (no login activity) for 1 month (30 days) are automatically deactivated by the system. An audit log is generated when this occurs, and you must contact an administrator to restore access." 
                    />
                    
                    <Section 
                        title="5. Device Data & Connectivity" 
                        content="MyphoLens requires an active internet connection to authenticate your session, load external WebViews, and render 3D models. We collect standard app analytics and crash reports to improve application stability." 
                    />

                    <Section 
                        title="6. Data Sharing & Security" 
                        content="We do not sell your personal data to third parties. Information is only shared internally between students and their explicitly assigned instructors. All backend requests are secured using encrypted authentication tokens." 
                    />

                    <Section 
                        title="7. Your Rights" 
                        content="You have the right to update your profile information, manage your bookmarks, and manually clear your entire scan history at any time through the app's settings." 
                    />
                </View>

                <View style={localStyles.footer}>
                    <Text style={localStyles.footerText}>© 2026 MyphoLens. All rights reserved.</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const localStyles = StyleSheet.create({
    header: { 
        backgroundColor: '#153c2a', 
        paddingHorizontal: 20, 
        paddingTop: Platform.OS === 'ios' ? 60 : 40, 
        paddingBottom: 25,
        borderBottomLeftRadius: 10, 
        borderBottomRightRadius: 10,
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10
    },
    headerTopRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'relative',
        paddingTop: 15,
    },
    backBtn: { 
        position: 'absolute', 
        left: 0, 
        zIndex: 10,
        padding: 4,
        paddingTop: 15,
    },
    headerTextContainer: { 
        alignItems: 'center', 
        paddingHorizontal: 40 
    },
    headerTitle: { 
        fontSize: 25, 
        fontWeight: '900', 
        color: '#fff', 
        textAlign: 'center' 
    },
    scrollContent: { 
        padding: 20, 
        paddingBottom: 50 
    },
    card: {
        borderRadius: 10,
        padding: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 8,
    },
    lastUpdatedContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 25,
        alignSelf: 'flex-start'
    },
    lastUpdatedText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B'
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 8,
        letterSpacing: 0.3
    },
    sectionText: {
        fontSize: 13,
        lineHeight: 24,
        fontWeight: '500',
    },
    footer: {
        marginTop: 20,
        alignItems: 'center'
    },
    footerText: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600'
    }
});