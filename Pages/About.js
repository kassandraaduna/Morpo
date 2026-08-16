import React, { useContext } from 'react';
import { 
    View, Text, ScrollView, TouchableOpacity, 
    StyleSheet, Platform, StatusBar, Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from './src/context/ThemeContext';

export default function About({ navigation }) {
    const { theme } = useContext(ThemeContext);

    return (
        <View style={{ flex: 1, backgroundColor: theme?.bg || '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor="#153c2a" />

            <View style={localStyles.header}>
                <View style={localStyles.headerTopRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backBtn}>
                        <Ionicons name="arrow-back" size={28} color="#fff" />
                    </TouchableOpacity>
                    <View style={localStyles.headerTextContainer}>
                        <Text style={localStyles.headerTitle}>About MyphoLens</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={localStyles.logoContainer}>
                    <Image 
                        source={require('../assets/mypholens_logo.png')} 
                        style={localStyles.logoImage} 
                    />
                    <Text style={[localStyles.appName, { color: theme?.text || '#153c2a' }]}>MyphoLens</Text>
                    <Text style={localStyles.appVersion}>Version 1.0.0</Text>
                </View>

                <View style={[localStyles.card, { backgroundColor: theme?.card || '#FFF' }]}>
                    <Text style={[localStyles.sectionTitle, { color: theme?.text || '#1E293B' }]}>Our Mission</Text>
                    <Text style={[localStyles.sectionText, { color: theme?.subText || '#64748B' }]}>
                        MyphoLens is an AI-powered educational platform designed to help students and instructors explore the microscopic world. By integrating cutting-edge machine learning and interactive 3D models, we aim to make the study of fungi—specifically Yeasts and Molds—more accessible, engaging, and interactive.
                    </Text>
                </View>

                <View style={[localStyles.card, { backgroundColor: theme?.card || '#FFF' }]}>
                    <Text style={[localStyles.sectionTitle, { color: theme?.text || '#1E293B' }]}>Key Features</Text>
                    
                    <View style={localStyles.featureRow}>
                        <View style={localStyles.featureIconBox}>
                            <Ionicons name="scan" size={20} color="#153c2a" />
                        </View>
                        <Text style={[localStyles.featureText, { color: theme?.subText || '#64748B' }]}>AI Scanner & Classifier</Text>
                    </View>
                    
                    <View style={localStyles.featureRow}>
                        <View style={localStyles.featureIconBox}>
                            <Ionicons name="cube" size={20} color="#153c2a" />
                        </View>
                        <Text style={[localStyles.featureText, { color: theme?.subText || '#64748B' }]}>Interactive 3D Models</Text>
                    </View>
                    
                    <View style={localStyles.featureRow}>
                        <View style={localStyles.featureIconBox}>
                            <Ionicons name="school" size={20} color="#153c2a" />
                        </View>
                        <Text style={[localStyles.featureText, { color: theme?.subText || '#64748B' }]}>Personalized Remedial Lessons</Text>
                    </View>
                    
                    <View style={localStyles.featureRow}>
                        <View style={localStyles.featureIconBox}>
                            <Ionicons name="clipboard" size={20} color="#153c2a" />
                        </View>
                        <Text style={[localStyles.featureText, { color: theme?.subText || '#64748B' }]}>Practice Studio & Assessments</Text>
                    </View>
                </View>

                <View style={localStyles.footer}>
                    <Text style={localStyles.footerText}>Developed for Educational Purposes.</Text>
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
    
    logoContainer: {
        alignItems: 'center',
        marginBottom: 10,
    },
    logoImage: {
        width: 200,
        height: 200,
        resizeMode: 'contain',
    },
    appName: {
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    appVersion: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94A3B8',
        marginTop: 4,
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
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 12,
        letterSpacing: 0.3
    },
    sectionText: {
        fontSize: 13,
        lineHeight: 24,
        fontWeight: '500',
    },
    
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    featureIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#E7F5EE',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    featureText: {
        fontSize: 13,
        fontWeight: '700',
        flex: 1,
    },

    footer: {
        marginTop: 10,
        alignItems: 'center'
    },
    footerText: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '600',
        marginBottom: 4,
    }
});