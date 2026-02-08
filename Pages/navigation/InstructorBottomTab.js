import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import InstructorHomepage from '../InstructorHomepage';
import Learn from '../Learn';
import Scan from '../Scan';
import StudentMonitoring from '../StudentMonitoring';
import Profile from '../Profile';
import { ThemeContext } from '../src/context/ThemeContext';

const Tab = createBottomTabNavigator();

export default function InstructorBottomTab() {
    const { theme } = useContext(ThemeContext);

    return (
        <Tab.Navigator
        screenOptions={({ route }) => ({
            headerShown: false,
            tabBarShowLabel: false,

            tabBarStyle: {
            height: 70,
            backgroundColor: theme.bg,
            borderTopColor: theme.subText,
            },

            tabBarActiveTintColor: theme.text,
            tabBarInactiveTintColor: theme.subText,

            tabBarIcon: ({ focused, color }) => {
            let icon;

            switch (route.name) {
                case 'Home':
                icon = focused ? 'home' : 'home-outline';
                break;
                case 'Learn':
                icon = focused ? 'book' : 'book-outline';
                break;
                case 'Scan':
                icon = focused ? 'camera' : 'camera-outline';
                break;
                case 'Students':
                icon = focused ? 'people' : 'people-outline';
                break;
                case 'Profile':
                icon = focused ? 'person' : 'person-outline';
                break;
                default:
                icon = 'ellipse';
            }

            return <Ionicons name={icon} size={24} color={color} />;
            },
        })}
        >
        <Tab.Screen name="Home" component={InstructorHomepage} />
        <Tab.Screen name="Learn" component={Learn} />
        <Tab.Screen name="Scan" component={Scan} />
        <Tab.Screen name="Students" component={StudentMonitoring} />
        <Tab.Screen name="Profile" component={Profile} />
        </Tab.Navigator>
    );
}