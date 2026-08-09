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
import Learn from './Pages/Learn';
import LessonStudent from './Pages/LessonStudent';
import TakeAssessment from './Pages/TakeAssessment';
import ModelViewerMobile from './Pages/ModelViewerMobile';
import CreatePractice from './Pages/CreatePractice';
import StudentMonitoring from './Pages/StudentMonitoring';
import StudentProgressDetail from './Pages/StudentProgressDetail';
import UploadLesson from './Pages/UploadLesson';
import Bookmarks from './Pages/Bookmarks';
import ArchiveLessons from './Pages/ArchiveLessons';
import AssessmentQuestionsView from './Pages/AssessmentQuestionsView';
import ScanHistory from './Pages/ScanHistory';
import DatasetLibrary from './Pages/DatasetLibrary';
import Notifications from './Pages/Notifications';
import AssessmentWebViewer from './Pages/AssessmentWebViewer';
import CreateAssessmentLink from './Pages/CreateAssessmentLink';
import CreateAssessmentAI from './Pages/CreateAssessmentAI';
import CreateAssessmentManual from './Pages/CreateAssessmentManual';

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
        <Stack.Screen name="Splash" component={Splash} options={{ headerShown: false }}/>
        <Stack.Screen name="Onboarding" component={Onboarding} options={{ headerShown: false }}/>
        <Stack.Screen name="Login" component={Login} options={{ headerShown: false }}/>
        <Stack.Screen name="Register" component={Register} options={{ headerShown: false }}/>
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }}/>
        <Stack.Screen name="StudentBottomTab" component={StudentBottomTab} />
        <Stack.Screen name="EditProfile" component={EditProfile} options={{ headerShown: false }}/>
        <Stack.Screen name="Termms" component={Terms} options={{ headerShown: false }}/>
        <Stack.Screen name="Privacy" component={Privacy} options={{ headerShown: false }}/>
        <Stack.Screen name="ChangePassword" component={ChangePassword} options={{ headerShown: false }}/>
        <Stack.Screen name="FAQs" component={FAQs} options={{ headerShown: false }}/>
        <Stack.Screen name="About" component={About} options={{ headerShown: false }}/>
        <Stack.Screen name="InstructorBottomTab" component={InstructorBottomTab} />
        <Stack.Screen name="Learn" component={Learn} options={{ headerShown: false }} />
        <Stack.Screen name="LessonStudent" component={LessonStudent} options={{ headerShown: false }}/>
        <Stack.Screen name="TakeAssessment" component={TakeAssessment} options={{ headerShown: false }}/>
        <Stack.Screen name="ModelViewerMobile" component={ModelViewerMobile} options={{ headerShown: false }}/>
        <Stack.Screen name="CreatePractice" component={CreatePractice} options={{ headerShown: false }}/>
        <Stack.Screen name="StudentMonitoring" component={StudentMonitoring} options={{ headerShown: false }} />
        <Stack.Screen name="StudentProgressDetail" component={StudentProgressDetail} options={{ headerShown: false }} />
        <Stack.Screen name="UploadLesson" component={UploadLesson} options={{ headerShown: false }} />
        <Stack.Screen name="Bookmarks" component={Bookmarks} options={{ headerShown: false }} />
        <Stack.Screen name="ArchiveLessons" component={ArchiveLessons} options={{ headerShown: false }} />
        <Stack.Screen name="AssessmentQuestionsView" component={AssessmentQuestionsView} options={{ headerShown: false }} />
        <Stack.Screen name="ScanHistory" component={ScanHistory} options={{ headerShown: false }} />
        <Stack.Screen name="DatasetLibrary" component={DatasetLibrary} options={{ headerShown: false }} />
        <Stack.Screen name="Notifications" component={Notifications} options={{ headerShown: false }} />
        <Stack.Screen name="AssessmentWebViewer" component={AssessmentWebViewer} options={{ headerShown: false }} />
        <Stack.Screen name="CreateAssessmentLink" component={CreateAssessmentLink} options={{ headerShown: true, title: "Add Link" }} />
        <Stack.Screen name="CreateAssessmentManual" component={CreateAssessmentManual} options={{ headerShown: true, title: "Manual Entry" }} />
        <Stack.Screen name="CreateAssessmentAI" component={CreateAssessmentAI} options={{ headerShown: true, title: "AI Generator" }} />
        </Stack.Navigator>
    </NavigationContainer>
  );
}
