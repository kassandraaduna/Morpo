import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import Homepage from '../Home';
import Learn from '../Learn';
import Scan from '../Scan';
import Models from '../Models';
import Profile from '../Profile';

const Tab = createBottomTabNavigator();

export default function BotttomTab() {
    return (
        <Tab.Navigator
        screenOptions={({ route }) => ({
            headerShown: false,
            tabBarShowLabel: false,
            tabBarStyle: {
            height: 60,
            borderTopWidth: 1,
            },
            tabBarIcon: ({ focused, size }) => {
            let icon;

            if (route.name === 'Home') icon = focused ? 'home' : 'home-outline';
            if (route.name === 'Learn') icon = focused ? 'book' : 'book-outline';
            if (route.name === 'Scan') icon = focused ? 'camera' : 'camera-outline';
            if (route.name === 'Models') icon = focused ? 'bookmark' : 'bookmark-outline';
            if (route.name === 'Profile') icon = focused ? 'person' : 'person-outline';

            return (
                <Ionicons
                name={icon}
                size={route.name === 'Scan' ? 32 : 24}
                />
            );
            },
        })}
        >
        <Tab.Screen name="Home" component={Homepage} />
        <Tab.Screen name="Learn" component={Learn} />
        <Tab.Screen name="Scan" component={Scan} />
        <Tab.Screen name="Models" component={Models} />
        <Tab.Screen name="Profile" component={Profile} />
        </Tab.Navigator>
    );
}
