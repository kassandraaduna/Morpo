import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomTab from './Pages/navigation/BottomTab';

import Splash from './Pages/Splash';
import Onboarding from './Pages/Onboarding';
import Login from './Pages/Login'; 
import Home from './Pages/Home';
import Register from './Pages/Register';

const Stack = createStackNavigator();

const AppController = () => {
  const [initialRoute, setInitialRoute] = useState('Splash');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
        
        if (onboardingCompleted === 'true') {
          setInitialRoute('Login');
        } 
        else {
          setInitialRoute('Splash');
        }
      } 
      catch (error) {
        console.error('Error checking onboarding status:', error);
        setInitialRoute('Splash');
      } 
      finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
  <Stack.Navigator 
    initialRouteName={initialRoute}
    screenOptions={{ headerShown: false }}
  >
    <Stack.Screen name="Splash" component={Splash} />
    <Stack.Screen name="Onboarding" component={Onboarding} />
    <Stack.Screen name="Login" component={Login} />
    <Stack.Screen name="Register" component={Register} />
    <Stack.Screen name="Homepage" component={Home} />
    <Stack.Screen name="MainTabs" component={BottomTab} />
  </Stack.Navigator>
</NavigationContainer>

  );
};

export default AppController;