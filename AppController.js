import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// (Keep all your screen imports here verbatim)
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
import DraftAssessments from './Pages/DraftAssessments';
import EditAssessment from './Pages/EditAssessment';
import StudentResultViewer from './Pages/StudentResultViewer';

import { AuthContext } from './Pages/src/context/authContext';

const Stack = createStackNavigator();

export default function AppController() {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) return null;

  const isInstructor = (user?.role || '').toLowerCase() === 'instructor';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="Register" component={Register} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        ) : (
          <>
            {isInstructor ? (
              <Stack.Screen name="InstructorBottomTab" component={InstructorBottomTab} />
            ) : (
              <Stack.Screen name="StudentBottomTab" component={StudentBottomTab} />
            )}

            <Stack.Screen name="EditProfile" component={EditProfile} />
            <Stack.Screen name="Terms" component={Terms} />
            <Stack.Screen name="Privacy" component={Privacy} />
            <Stack.Screen name="ChangePassword" component={ChangePassword} />
            <Stack.Screen name="FAQs" component={FAQs} />
            <Stack.Screen name="About" component={About} />
            <Stack.Screen name="Learn" component={Learn} />
            <Stack.Screen name="LessonStudent" component={LessonStudent} />
            <Stack.Screen name="TakeAssessment" component={TakeAssessment} />
            <Stack.Screen name="ModelViewerMobile" component={ModelViewerMobile} />
            <Stack.Screen name="CreatePractice" component={CreatePractice} />
            <Stack.Screen name="StudentMonitoring" component={StudentMonitoring} />
            <Stack.Screen name="StudentProgressDetail" component={StudentProgressDetail} />
            <Stack.Screen name="UploadLesson" component={UploadLesson} />
            <Stack.Screen name="Bookmarks" component={Bookmarks} />
            <Stack.Screen name="ArchiveLessons" component={ArchiveLessons} />
            <Stack.Screen name="AssessmentQuestionsView" component={AssessmentQuestionsView} />
            <Stack.Screen name="ScanHistory" component={ScanHistory} />
            <Stack.Screen name="DatasetLibrary" component={DatasetLibrary} />
            <Stack.Screen name="Notifications" component={Notifications} />
            <Stack.Screen name="AssessmentWebViewer" component={AssessmentWebViewer} />
            <Stack.Screen name="CreateAssessmentLink" component={CreateAssessmentLink} />
            <Stack.Screen name="CreateAssessmentManual" component={CreateAssessmentManual} />
            <Stack.Screen name="CreateAssessmentAI" component={CreateAssessmentAI} />
            <Stack.Screen name="DraftAssessments" component={DraftAssessments} />
            <Stack.Screen name="EditAssessment" component={EditAssessment} />
            <Stack.Screen name="StudentResultViewer" component={StudentResultViewer} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}