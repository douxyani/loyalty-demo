import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert, Linking } from 'react-native';
import { supabase } from './supabase';

// Helper to get projectId for getExpoPushTokenAsync
export const getProjectId = () =>
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined;

// Helper to send push token to backend (avoid duplicates)
export const registerPushToken = async (userId: string, token: string) => {
    // Upsert to avoid duplicates (requires unique constraint on user_id + push_token)
    console.log(`we found a push token: ${token}`)
    await supabase
        .from('user_push_tokens')
        .upsert(
            { user_id: userId, push_token: token },
            { onConflict: 'user_id,push_token' }
        );
};

// Request notification permissions and register token
export const requestAndRegisterPushToken = async (userId: string) => {
    try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Stay Updated!',
                'Enable notifications to receive important updates and rewards.',
                [
                    {
                        text: 'Not Now',
                        style: 'cancel',
                    },
                    {
                        text: 'Enable',
                        onPress: async () => {
                            const { status: reqStatus } = await Notifications.requestPermissionsAsync();
                            if (reqStatus === 'granted') {
                                const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
                                await registerPushToken(userId, tokenData.data);
                            } else {
                                Alert.alert(
                                    'Notifications Disabled',
                                    'You can enable notifications anytime in your device settings.',
                                    [
                                        {
                                            text: 'Open Settings',
                                            onPress: () => {
                                                if (Platform.OS === 'ios') {
                                                    Linking.openURL('app-settings:');
                                                } else {
                                                    Linking.openSettings();
                                                }
                                            }
                                        },
                                        { text: 'OK', style: 'cancel' }
                                    ]
                                );
                            }
                        }
                    }
                ]
            );
        } else {
            console.log("i'm down here: "+ getProjectId())
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: getProjectId() });
            await registerPushToken(userId, tokenData.data);
        }
    } catch (e) {
        console.log(e)
        // Optionally handle error
    }
};

export const sendPostNotification = async (postId: string, title: string, details: string) => {
    // Calls your Supabase Edge Function (adjust function name if needed)
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-post`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
            record: {
                id: postId,
                title,
                details
            }
        })
    });
    if (!res.ok) {
        throw new Error('Failed to trigger notification');
    }
    return await res.json();
};
