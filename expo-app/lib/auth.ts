import { supabase } from './supabase';
import { saveAuthData, removeAuthData } from './authStorage';

type SignUpData = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  referralCode?: string;
};

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (data?.session) {
    await saveAuthData({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }

  return { data, error };
}

export async function signUpWithEmail(data: SignUpData) {
  const { email, password, firstName, lastName, referralCode } = data;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: `${firstName} ${lastName}`,
        referred_by_code: referralCode ?? null,
      },
    },
  });

  if (authError) {
    return { data: null, error: authError };
  }

  return { data: authData, error: null };
}

export async function signInWithGoogle(idToken: string, accessToken?: string | null) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    access_token: accessToken ?? undefined,
  });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

export async function signOut() {
  await removeAuthData();
  return await supabase.auth.signOut();
}
