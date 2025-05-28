import * as React from 'react';
import { Button } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

type Props = {
  onSuccess: (auth: { accessToken: string | null, idToken: string | null }) => void;
  disabled?: boolean;
  mode: 'signin' | 'signup';
};

export default function GoogleSignInComponent({ onSuccess, disabled, mode }: Props) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    clientSecret: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET,
    // Optionally add redirectUri if needed
    // redirectUri: process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      onSuccess({
        accessToken: authentication?.accessToken ?? null,
        idToken: authentication?.idToken ?? null,
      });
    }
  }, [response]);

  return (
    <Button
      disabled={!request || disabled}
      title={mode === 'signin' ? "Sign in with Google" : "Sign up with Google"}
      color="#4285F4"
      onPress={() => promptAsync()}
    />
  );
}
