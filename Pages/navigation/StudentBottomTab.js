import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
