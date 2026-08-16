import React, { useContext } from 'react';
import { 
    View, Text, ScrollView, TouchableOpacity, 
    StyleSheet, Platform, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';

export default function Terms({ navigation }) {
    const { theme } = useContext(ThemeContext);

    // Reusable component for each terms section
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
                        <Text style={localStyles.headerTitle}>Terms & Conditions</Text>
                    </View>
                </View>
            </View>

            {/* TERMS CONTENT */}
            <ScrollView contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[localStyles.card, { backgroundColor: theme?.card || '#FFF' }]}>
                    
                    <View style={localStyles.lastUpdatedContainer}>
                        <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                        <Text style={localStyles.lastUpdatedText}>Last Updated: August 2026</Text>
                    </View>
                    
                    <Section 
                        title="1. Acceptance of Terms" 
                        content="By downloading, installing, accessing, or using the MyphoLens application, you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the application." 
                    />
                    
                    <Section 
                        title="2. Educational Purposes Only & Medical Disclaimer" 
                        content="THIS APPLICATION IS INTENDED FOR EDUCATIONAL PURPOSES ONLY AND IS NOT DESIGNED FOR MEDICAL DIAGNOSIS. The AI classifications, 3D models, and study materials provided by MyphoLens should never replace professional medical advice, diagnosis, or treatment. Users must consult qualified healthcare professionals for medical guidance." 
                    />
                    
                    <Section 
                        title="3. User Accounts & Security" 
                        content="You are responsible for maintaining the confidentiality of your account credentials (username, email, and password). You agree to accept responsibility for all activities that occur under your account. Instructors must ensure that assessments, external links, and materials shared comply with their institutional guidelines." 
                    />
                    
                    <Section 
                        title="4. AI Scanning & Practice Assessments" 
                        content="The MyphoAI scanner provides automated analysis and generates recommended remedial lessons based on user performance. While we strive for high accuracy through our diagnostic matrix and feature sweeps, AI-generated results may occasionally contain errors and should always be verified against standard academic references." 
                    />
                    
                    <Section 
                        title="5. Intellectual Property" 
                        content="All content, features, and functionality within the app—including but not limited to 3D models, AI algorithms, text, graphics, and logos—are the exclusive property of MyphoLens and its licensors. You may not copy, modify, distribute, or reverse-engineer any part of the application." 
                    />
                    
                    <Section 
                        title="6. Internet Connectivity Requirements" 
                        content="An active, stable internet connection is required to sync assessment progress, fetch assignments, submit scores, run AI scans, and render 3D models. MyphoLens is not responsible for unsaved progress resulting from network disconnections." 
                    />

                    <Section 
                        title="7. Limitation of Liability" 
                        content="In no event shall MyphoLens, its developers, or affiliates be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of the application, including data loss or academic performance." 
                    />

                    <Section 
                        title="8. Modifications to Terms" 
                        content="We reserve the right to modify these terms at any time. We will notify users of any significant changes by updating the 'Last Updated' date at the top of this document. Continued use of the app after changes indicates your acceptance of the revised terms." 
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
        borderRadius: 1,
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