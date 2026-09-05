import React, { useContext } from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import StudentHomepage from '../StudentHomepage';
import Learn from '../Learn';
import Scan from '../Scan';
import AssessmentStudent from '../AssessmentStudent';
import Profile from '../Profile';
import { ThemeContext } from '../src/context/ThemeContext';

const Tab = createBottomTabNavigator();

export default function StudentBottomTab() {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '800' },
        tabBarActiveTintColor: '#153c2a',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 10,
          height: Platform.OS === 'ios' ? 80 : 65,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 5,
          height: 60 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
        },
        tabBarIcon: ({ focused, color }) => {
          let icon;
          if (route.name === 'Home') icon = focused ? 'home' : 'home';
          if (route.name === 'Learn') icon = focused ? 'book' : 'book';
          if (route.name === 'Scan') icon = focused ? 'scan' : 'scan';
          if (route.name === 'Assessments') icon = focused ? 'clipboard' : 'clipboard';
          if (route.name === 'Profile') icon = focused ? 'person' : 'person';

          return <Ionicons name={icon} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={StudentHomepage} />
      <Tab.Screen name="Learn" component={Learn} />
      <Tab.Screen name="Scan" component={Scan} />
      <Tab.Screen name="Assessments" component={AssessmentStudent} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}