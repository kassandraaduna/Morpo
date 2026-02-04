import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import StudentHomepage from '../StudentHomepage';
import Learn from '../Learn';
import Scan from '../Scan';
import Models from '../Models';
import Profile from '../Profile';

const Tab = createBottomTabNavigator();

export default function BottomTab() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { height: 70 },
        tabBarIcon: ({ focused }) => {
          let icon;
          if (route.name === 'Home') icon = focused ? 'home' : 'home-outline';
          if (route.name === 'Learn') icon = focused ? 'book' : 'book-outline';
          if (route.name === 'Scan') icon = focused ? 'camera' : 'camera-outline';
          if (route.name === 'Models') icon = focused ? 'cube' : 'cube-outline';
          if (route.name === 'Profile') icon = focused ? 'person' : 'person-outline';

          return <Ionicons name={icon} size={24} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={StudentHomepage} />
      <Tab.Screen name="Learn" component={Learn} />
      <Tab.Screen name="Scan" component={Scan} />
      <Tab.Screen name="Models" component={Models} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}
