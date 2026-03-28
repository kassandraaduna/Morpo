import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#f4f7f5',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ================= SPLASH / AUTH ================= */

    splashLogoContainer: {
        flex: 1,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    splashLogo: {
        width: 350,
        height: 300,
        resizeMode: 'contain',
    },  
    shell: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f4f7f5',
        alignItems: 'center',
        paddingTop: 10,
    },
    card: {
        width: '100%',
        flex: 1,
        backgroundColor: '#e7f8f2',
        borderRadius: 28,
        padding: 25,
    },
    bottomLink: {
        marginTop: 'auto',
        paddingBottom: 20,
        alignItems: 'center',
    },      
    logo: {
        width: 350,
        height: 300,
        resizeMode: 'contain',
    },  
    title: {
        fontSize: 32,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        color: '#555',
        marginBottom: 18,
    },  
    input: {
        height: 45,
        backgroundColor: '#FFF',
        borderRadius: 50,
        paddingHorizontal: 14,
        marginBottom: 12,
    },
    primaryBtn: {
        backgroundColor: '#153c2a',
        borderRadius: 28,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 12,
    },
    disabled: {
        opacity: 0.5,
    },
    btnText: {
        fontWeight: '700',
        color: '#fff',
        fontSize: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 10,
        marginBottom: 5,
        color: '#000',
    },
    passwordWrapper: {
        position: 'relative',
        marginBottom: 5,
    },
    passwordInput: {
        height: 46,
        backgroundColor: '#FFF',
        borderRadius: 30,
        paddingHorizontal: 16,
        paddingRight: 50,
    },
    eyeIcon: {
        position: 'absolute',
        right: 14,
        top: 13,
    },
    forgotWrapper: {
        alignSelf: 'flex-end',
        marginTop: 6,
        marginBottom: 14,
    },
    forgotText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
    },
    link: {
        textAlign: 'center',
        fontSize: 14,
        margin: 25,
        color: '#444',
    },
    terms: {
        textAlign: 'center',
        fontSize: 13,
        marginTop: 25,
        paddingBottom: 20,
        color: '#444',
    },

    /* ================= OTP / DISCLAIMER ================= */

    otpRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    otpBox: {
        width: 42,
        height: 48,
        backgroundColor: '#FFF',
        borderRadius: 10,
        textAlign: 'center',
        fontSize: 18,
    },  
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    disclaimerCard: {
        width: '85%',
        backgroundColor: '#e7f8f2',
        borderRadius: 26,
        padding: 22,
    },
    disclaimerTitle: {
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 10,
    },
    disclaimerText: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 18,
    },

    /* ================= ONBOARDING ================= */

    slide: {
        alignItems: 'center',
        paddingTop: 40,
    },
    image: {
        width: 260,
        height: 200,
        resizeMode: 'contain',
        marginBottom: 20,
    },
    onboardingCard: {
        backgroundColor: '#e7f8f2',
        borderRadius: 26,
        padding: 20,
        width: '85%',
    },
    onboardingTitle: {
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
    },
    text: {
        fontSize: 13,
        textAlign: 'center',
    },
    skip: {
        fontSize: 13,
        alignSelf: 'flex-end',
        marginRight: 30,
        marginTop: 8,
    },

    /* ================= INSTRUCTOR / STUDENT HOME ================= */
    scrollScreen: { 
        backgroundColor: '#FFF' 
    },
    pageContainer: {
        padding: 16,
        // paddingBottom: 110,
        paddingTop: 30,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    studentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 15,
    },
    quickCard: {
        width: '30%',
        borderRadius: 12,
        alignItems: 'center',
        paddingVertical: 16,
        marginBottom: 12,
    },
    scanCard: {
        width: 260,
        backgroundColor: '#e7f8f2',
        borderRadius: 15,
        marginRight: 12,
        marginBottom: 25,
        padding: 10,
    },
    assessmentHighlight: {
        backgroundColor: '#e7f8f2',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },      
    profileText: {
        fontSize: 16,
        marginRight: 6,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    appTitle: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    roleText: {
        fontSize: 12,
        marginTop: 2,
    },
    profilePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#e6eae8',
        borderRadius: 25,
        paddingHorizontal: 15,
        paddingVertical: 10,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '600',
    },      
    greeting: {
        fontSize: 22,
        fontWeight: '700',
        marginVertical: 14,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 25,
        paddingHorizontal: 14,
        height: 42,
        marginBottom: 20,
    },
    searchInput: {
        marginLeft: 8,
        flex: 1,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    gridItem: {
        width: '22%',
        alignItems: 'center',
        marginBottom: 16,
    },
    gridIcon: {
        width: 64,
        height: 64,
        backgroundColor: '#e7f8f2',
        borderRadius: 12,
        marginBottom: 6,
    },
    gridLabel: {
        fontSize: 10,
        textAlign: 'center',
    },
    statsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D9E0CC',
        borderRadius: 18,
        padding: 14,
        marginBottom: 20,
    },
    statsIcon: {
        width: 48,
        height: 48,
        backgroundColor: '#FFF',
        borderRadius: 12,
        marginRight: 12,
    },
    statsNumber: {
        fontSize: 20,
        fontWeight: '800',
    },
    statsLabel: {
        fontSize: 12,
    },
    assessmentCard: {
        backgroundColor: '#D6EEAA',
        borderRadius: 18,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    assessmentTitle: { 
        fontWeight: '700' 
    },
    assessmentMeta: { 
        fontSize: 11 
    },
    assessmentFeedback: { 
        fontSize: 11, 
        marginTop: 6 
    },
    scoreBox: { 
        alignItems: 'center' 
    },
    score: { 
        fontSize: 22, 
        fontWeight: '800' 
    },
    viewBtn: {
        backgroundColor: '#FFF',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginTop: 6,
    },
    viewText: { 
        fontSize: 12, 
        fontWeight: '700' 
    },
    topicCard: {
        width: 140,
        borderWidth: 1,
        borderRadius: 14,
        marginRight: 12,
        overflow: 'hidden',
    },
    topicImage: { 
        height: 90, 
        backgroundColor: '#e7f8f2' 
    },
    topicText: {
        padding: 8,
        fontSize: 11,
        textAlign: 'center',
    },
    alertCard: {
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
    },
    alertDanger: {
        backgroundColor: '#e7f8f2',
    },
    alertWarning: {
        backgroundColor: '#F6E1BE',
    },
    alertTitle: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 4,
    },
    alertText: {
        fontSize: 11,
    },

/* ================= CONFIRMATION MESSAGE ================= */
    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    confirmSheet: {
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    confirmTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
    },
    confirmMessage: {
        fontSize: 13,
        marginBottom: 16,
    },
    confirmActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    confirmCancel: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginRight: 8,
    },
    confirmCancelText: {
        fontWeight: '600',
    },
    confirmConfirm: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    confirmConfirmText: {
        fontWeight: '700',
    },
    confirmDanger: {
        backgroundColor: '#F44336',
    },      

/* ================= PROFILE ================= */
    accountContainer: {
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingTop: 30,
        paddingBottom: 110,
    },
    accountHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: 12,
    },
    headerSide: {
        width: 24,
    },
    accountTitle: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
    },      
    accountProfile: {
        alignItems: 'center',
        marginVertical: 16,
    },
    accountProfileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
    },
    accountProfileText: {
        marginLeft: 12,
    },
    accountAvatar: {
        width: 100,
        height: 100,
        borderRadius: 100,
        backgroundColor: '#e7f8f2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    accountName: {
        fontSize: 18,
        fontWeight: '700',
    },
    accountEmail: {
        fontSize: 16,
        color: '#777',
    },
    accountRow: {
        backgroundColor: '#e7f8f2',
        borderRadius: 10,
        height: 50,
        paddingVertical: 14,
        paddingHorizontal: 12,
        marginVertical: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    accountRowText: {
        fontSize: 13,
        fontWeight: '600',
    },
    accountLogoutRow: {
        backgroundColor: '#EC4A56',
        borderRadius: 10,
        height: 50,
        paddingHorizontal: 12,
        marginTop: 50,
        marginBottom: 6,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },      
    accountSection: {
        marginTop: 18,
        marginBottom: 6,
        fontSize: 16,
        fontWeight: '700',
    },   

/* ================= EDIT PROFILE ================= */
    editHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 40,
        paddingBottom: 6,
    },
    editTitle: {
        fontSize: 24,
        fontWeight: '700',
        textAlign: 'center',
    },
    editCard: {
        borderRadius: 18,
        padding: 15,
        marginBottom: 20,
    },
    editFieldWrap: {
        marginBottom: 10,
    },
    editInput: {
        height: 44,
        borderRadius: 20,
        paddingHorizontal: 14,
        fontSize: 14,
    },
    editDisabled: {
        opacity: 0.6,
    },
    fieldError: {
        fontSize: 11,
        color: '#E14B4B',
        marginTop: 4,
        marginLeft: 6,
    },
    saveBtn: {
        backgroundColor: '#153c2a',
        borderRadius: 28,
        paddingVertical: 14,
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 10,
    },
    BtnText: {
        fontWeight: '700',
        fontSize: 18,
        color: '#000',
    },    
});

export default styles;
