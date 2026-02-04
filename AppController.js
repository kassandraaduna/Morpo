import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomTab from './Pages/navigation/BottomTab';

import Splash from './Pages/Splash';
import Onboarding from './Pages/Onboarding';
import Login from './Pages/Login'; 
import StudentHomepage from './Pages/StudentHomepage';
import Register from './Pages/Register';
import ResetPasswordScreen from './Pages/ResetPasswordScreen';

const Stack = createStackNavigator();

const AppController = () => {
  const [initialRoute, setInitialRoute] = useState('Splash');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
      const user = await AsyncStorage.getItem('user');
  
      if (!onboardingCompleted) {
        setInitialRoute('Splash');
      } 
      else if (user) {
        setInitialRoute('MainTabs');
      } 
      else {
        setInitialRoute('Login');
      }
  
      setIsLoading(false);
    };
  
    bootstrap();
  }, []);
  
  

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
<Stack.Navigator screenOptions={{ headerShown: false }}>
  <Stack.Screen name="Splash" component={Splash} />
  <Stack.Screen name="Onboarding" component={Onboarding} />
  <Stack.Screen name="Login" component={Login} />
  <Stack.Screen name="Register" component={Register} />
  <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
  <Stack.Screen name="MainTabs" component={BottomTab} />
</Stack.Navigator>

</NavigationContainer>

  );
};

export default AppController;