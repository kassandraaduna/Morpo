import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../src/context/ThemeContext';
import InstructorHomepage from '../InstructorHomepage';
import Learn from '../Learn';
import Scan from '../Scan';
import StudentMonitoring from '../StudentMonitoring';
import Profile from '../Profile';

const Tab = createBottomTabNavigator();

export default function InstructorBottomTab() {
  const { theme } = useContext(ThemeContext);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#153c2a',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 0,
          elevation: 10,
          height: 60,
          paddingBottom: 10,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={InstructorHomepage} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }}
      />
      <Tab.Screen 
        name="Learn" 
        component={Learn} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="book" size={24} color={color} /> }}
      />
      <Tab.Screen
        name="Scan"
        component={Scan} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="camera" size={24} color={color} /> }}
      />
      <Tab.Screen 
        name="Student Monitoring" 
        component={StudentMonitoring} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="analytics" size={24} color={color} /> }}
      />
      <Tab.Screen 
        name="Profile" 
        component={Profile} 
        options={{ tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} /> }}
      />
    </Tab.Navigator>
  );
}