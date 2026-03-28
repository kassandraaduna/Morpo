import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Splash from './Pages/Splash';
import Onboarding from './Pages/Onboarding';
import Login from './Pages/Login';
import Register from './Pages/Register';
import ResetPasswordScreen from './Pages/ResetPasswordScreen';
import StudentBottomTab from './Pages/navigation/StudentBottomTab';
import InstructorBottomTab from './Pages/navigation/InstructorBottomTab';
import EditProfile from './Pages/EditProfile';
import Terms from './Pages/Terms';
import Privacy from './Pages/Privacy';
import ChangePassword from './Pages/ChangePassword';
import FAQs from './Pages/FAQs';
import About from './Pages/About';
import LessonStudent from './Pages/LessonStudent';
import TakeAssessment from './Pages/TakeAssessment';
import ModelViewerMobile from './Pages/ModelViewerMobile';
import CreatePractice from './Pages/CreatePractice';
import StudentMonitoring from './Pages/StudentMonitoring';
import StudentProgressDetail from './Pages/StudentProgressDetail';
import UploadLesson from './Pages/UploadLesson';

const Stack = createStackNavigator();

export default function AppController() {
  const [initialRoute, setInitialRoute] = useState('Splash');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
        const userRaw = await AsyncStorage.getItem('user');

        if (!onboardingCompleted) {
          setInitialRoute('Splash');
        } else if (userRaw) {
          const user = JSON.parse(userRaw);

          if ((user.role || '').toLowerCase() === 'instructor') {
            setInitialRoute('InstructorBottomTab');
          } else {
            setInitialRoute('StudentBottomTab');
          }
        } else {
          setInitialRoute('Login');
        }
      } catch {
        setInitialRoute('Login');
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  if (isLoading) return null;

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
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="StudentBottomTab" component={StudentBottomTab} />
        <Stack.Screen name="EditProfile" component={EditProfile} />
        <Stack.Screen name="Termms" component={Terms} />
        <Stack.Screen name="Privacy" component={Privacy} />
        <Stack.Screen name="ChangePassword" component={ChangePassword} />
        <Stack.Screen name="FAQs" component={FAQs} />
        <Stack.Screen name="About" component={About} />
        <Stack.Screen name="InstructorBottomTab" component={InstructorBottomTab} />
        <Stack.Screen name="LessonStudent" component={LessonStudent} />
        <Stack.Screen name="TakeAssessment" component={TakeAssessment} />
        <Stack.Screen name="ModelViewerMobile" component={ModelViewerMobile} />
        <Stack.Screen name="CreatePractice" component={CreatePractice} />
        <Stack.Screen name="StudentMonitoring" component={StudentMonitoring} options={{ headerShown: false }} />
        <Stack.Screen name="StudentProgressDetail" component={StudentProgressDetail} options={{ headerShown: false }} />
        <Stack.Screen name="UploadLesson" component={UploadLesson} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
