import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarStyle: {
          height: 65,
          backgroundColor: theme.bg,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#153c2a',
        tabBarInactiveTintColor: '#999999',

        tabBarIcon: ({ focused, color }) => {
          let icon;

          if (route.name === 'Home')
            icon = focused ? 'home' : 'home-outline';
          if (route.name === 'Learn')
            icon = focused ? 'book' : 'book-outline';
          if (route.name === 'Scan')
            icon = focused ? 'camera' : 'camera-outline';
          if (route.name === 'Assessments')
            icon = focused ? 'clipboard' : 'clipboard-outline';
          if (route.name === 'Profile')
            icon = focused ? 'person' : 'person-outline';

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
