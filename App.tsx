import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from 'sonner-native';
import { MaterialIcons } from '@expo/vector-icons';
import AuthScreen from './screens/AuthScreen';
import ProfileScreen from './screens/ProfileScreen';
import AdminScreen from './screens/AdminScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import HomeScreen from './screens/HomeScreen';
import QRScannerScreen from './screens/QRScannerScreen';
import AdminResultScreen from './screens/AdminResultScreen';
import RewardSettingsScreen from './screens/RewardSettingsScreen';
import ReferFriendScreen from './screens/ReferFriendScreen';
import ReferFriendSettingsScreen from './screens/ReferFriendSettingsScreen';
import PostsScreen from './screens/PostsScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, TabStackParamList } from './navigation/types';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabStackParamList>();

type MainTabsProps = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;

function MainTabs({ route }: MainTabsProps) {
  const { isAdmin, userId, email } = route.params;

  return (
    <Tab.Navigator
      initialRouteName={isAdmin ? 'AdminScreen' : 'Home'}
      screenOptions={{
        tabBarStyle: { paddingBottom: 5, height: 60 },
        tabBarActiveTintColor: '#007AFF',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        initialParams={{ userId, email, isAdmin }}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Posts"
        component={PostsScreen}
        initialParams={{ userId, isAdmin }}
        options={{
          title: 'Posts',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="campaign" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        initialParams={{ email }}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" size={24} color={color} />
          ),
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="AdminScreen"
          component={AdminScreen}
          initialParams={{ userId, email }}
          options={{
            title: 'Admin',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="admin-panel-settings" size={24} color={color} />
            ),
          }}
        />
      )}
    </Tab.Navigator>
  );
}

function RootStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AuthScreen" component={AuthScreen} />
      <Stack.Screen name="VerifyEmailScreen" component={VerifyEmailScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="QRScannerScreen" component={QRScannerScreen} />
      <Stack.Screen name="AdminResultScreen" component={AdminResultScreen} />
      <Stack.Screen name="RewardSettingsScreen" component={RewardSettingsScreen} />
      <Stack.Screen name="ReferFriendScreen" component={ReferFriendScreen} />
      <Stack.Screen name="ReferFriendSettingsScreen" component={ReferFriendSettingsScreen} />
      <Stack.Screen name="Posts" component={PostsScreen} />
      <Stack.Screen name="CreatePostScreen" component={CreatePostScreen} />
    </Stack.Navigator>
  );
}

const linking = {
  prefixes: ['loyaltyapp://', 'https://your-domain.com'],
  config: {
    screens: {
      AuthScreen: 'auth',
      MainTabs: {
        path: 'tabs',
        screens: {
          Home: 'home',
          ProfileScreen: 'profile',
          AdminScreen: 'admin',
        },
      },
    },
  },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let didSetInitial = false;

    const failSafeTimeout = setTimeout(() => {
      if (!didSetInitial) setLoading(false);
    }, 4000);

    // Use onAuthStateChange for initial session and updates
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!didSetInitial) {
        setLoading(false);
        didSetInitial = true;
      }
    });

    // Try to get the session if getSession exists
    if (typeof supabase.auth.getSession === 'function') {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data?.session ?? null);
        if (!didSetInitial) {
          setLoading(false);
          didSetInitial = true;
        }
      });
    } else {
      if (!didSetInitial) setLoading(false);
    }

    return () => {
      clearTimeout(failSafeTimeout);
      if (data && data.subscription && typeof data.subscription.unsubscribe === 'function') {
        data.subscription.unsubscribe();
      }
    };
  }, []);

  if (loading) {
    // Show a loading spinner with a background to avoid a black screen
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <Toaster />
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <Toaster />
        <NavigationContainer linking={linking}>
          <RootStack />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    userSelect: "none"
  }
});