import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import Login from './Pages/Login'; 
import Home from './Pages/Home';
import Register from './Pages/Register';

const Stack = createStackNavigator();

const AppController = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={Register} />
        <Stack.Screen name="Homepage" component={Home} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppController;