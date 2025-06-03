import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { signInWithEmail, signUpWithEmail } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner-native';
import GoogleSignInComponent from './GoogleSignInComponent';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAuthData, removeAuthData } from '../lib/authStorage';
import { theme } from '../styles/theme';
import { requestAndRegisterPushToken } from '../lib/pushNotifications';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'AuthScreen'>;
type SignupStep = 1 | 2;
type ValidationError = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function AuthScreen({ navigation }: Props) {
  const [checkingAuth, setCheckingAuth] = useState(true); // Add this line
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [errors, setErrors] = useState<ValidationError>({});
  const [referralCode, setReferralCode] = useState(''); // New state for referral code
  const translateY = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const heightAnimation = useRef(new Animated.Value(0)).current;

  const getUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user role:', (error as Error).message); // Explicitly cast error to Error
      throw error;
    }

    return data?.role;
  };

  // Only run checkAuth on first mount, not on every navigation to this screen
  useEffect(() => {
    let isMounted = true;
    const runCheck = async () => {
      await checkAuth();
      // If the user is not authenticated, setCheckingAuth(false) will show the manual login form
      // Do not navigate or replace to 'AuthScreen' again, just show the login UI
    };
    if (isMounted) runCheck();
    return () => { isMounted = false; };
  }, []); // Empty dependency array: only run once on mount

  const checkAuth = async () => {
    console.log('Checking authentication...');
    try {
      // Check stored credentials first
      const authData = await getAuthData();

      if (authData) {
        const { data, error } = await supabase.auth.setSession({
          access_token: authData.access_token,
          refresh_token: authData.refresh_token,
        });

        if (error) {
          // Remove invalid tokens if refresh token is already used or invalid
          if (
            error.message.includes('Invalid Refresh Token') ||
            error.message.includes('Token has been revoked') ||
            error.message.includes('Token expired')
          ) {
            await removeAuthData();
          }
          throw error;
        }

        if (data?.session?.user) {
          const role = await getUserRole(data.session.user.id);
          navigation.replace('MainTabs', {
            userId: data.session.user.id,
            email: data.session.user.email ?? '',
            isAdmin: role === 'admin',
          });
          return;
        }
      }

      // Then check for existing session
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (data?.session?.user) {
        const user = data.session.user;
        const role = await getUserRole(user.id);
        navigation.replace('MainTabs', {
          userId: user.id,
          email: user.email ?? '',
          isAdmin: role === 'admin',
        });
        return;
      }

    } catch (error) {
      if (error instanceof Error) {
        console.error('Auth restoration error:', error.message);
        if (error.message.includes('Network request failed')) {
          toast.error('Network error: Please check your internet connection.');
        }
      } else {
        console.error('Unknown error occurred during auth restoration:', error);
      }
      // Do NOT navigate.replace('AuthScreen') here!
      // Just let the manual login UI show by setting checkingAuth to false
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuth = async (type: 'signin' | 'signup') => {
    const newErrors: ValidationError = {};
    if (type === 'signup') {
      if (!validateEmail(email)) newErrors.email = 'Enter a valid email address';
      if (!validatePassword(password)) newErrors.password = 'Password must be at least 8 characters long and include a number';
      if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = type === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail({
          email,
          password,
          firstName,
          lastName,
          referralCode: referralCode.trim().toUpperCase() || undefined, // Pass referral code
        });

      if (error) {
        throw error;
      }

      if (type === 'signup' && data?.user) {
        // Only redirect if we have user data and no errors
        navigation.replace('VerifyEmailScreen');
        return;
      }

      if (type === 'signin' && data?.user) {
        const user = data.user;
        const role = await getUserRole(user.id);

        // Ensure the correct client is used based on the user's role
        const isAdmin = role === 'admin';

        console.log(`User role: ${role}, using ${isAdmin ? 'supabaseAdmin' : 'supabase'} client`);

        navigation.replace('MainTabs', {
          userId: user.id,
          email: user.email ?? '',
          isAdmin,
        });

        // Request notification permission and register token after login
        setTimeout(() => {
          requestAndRegisterPushToken(user.id);
        }, 500);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log('Error:', error.message);
        toast.error(error.message);
      } else {
        console.error('Unknown error occurred:', error);
        toast.error('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handles Google sign-in result from GoogleSignInComponent
  const handleGoogleAuthResult = async (auth: { accessToken: string | null, idToken: string | null }) => {
    setLoading(true);
    try {
      // Use snake_case keys as required by supabase-js API
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: auth.idToken ?? '',
        access_token: auth.accessToken ?? undefined,
      });
      if (error) throw error;
      if (!data?.user) throw new Error('No user data returned');
      const user = data.user;
      const role = await getUserRole(user.id);

      navigation.replace('MainTabs', {
        userId: user.id,
        email: user.email ?? '',
        isAdmin: role === 'admin'
      });

      // Request notification permission and register token after login
      setTimeout(() => {
        requestAndRegisterPushToken(user.id);
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: isLogin ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsLogin(!isLogin);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const validateName = (name: string): boolean => {
    return /^[a-zA-Z]{2,}$/.test(name);
  };

  const validateEmail = (email: string): boolean => {
    // Refined regex to handle valid email formats
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password);
  };

  const handleNextStep = () => {
    const newErrors: ValidationError = {};

    if (signupStep === 1) {
      if (!validateName(firstName)) newErrors.firstName = 'Enter a valid first name';
      if (!validateName(lastName)) newErrors.lastName = 'Enter a valid last name';

      if (Object.keys(newErrors).length === 0) {
        Animated.parallel([
          Animated.timing(slideAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(heightAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.inOut(Easing.ease),
          })
        ]).start(() => {
          setSignupStep(2);
        });
      }
    } else if (signupStep === 2) {
      if (!validateEmail(email)) newErrors.email = 'Enter a valid email address';
      if (!validatePassword(password)) newErrors.password = 'Password must be at least 8 characters long and include a number';
      if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
  };

  const handlePrevStep = () => {
    Animated.parallel([
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
      Animated.timing(heightAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
        easing: Easing.inOut(Easing.ease),
      })
    ]).start(() => {
      setSignupStep(1);
    });
  };

  const renderSignupStep = () => (
    <View style={styles.formWrapper}>
      <Animated.View style={[
        styles.formContainer,
        {
          height: heightAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [250, 400] // Increased for referral input
          })
        }
      ]}>
        <>
          <Animated.View
            style={[
              styles.formPage,
              {
                transform: [{
                  translateX: slideAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -width]
                  })
                }]
              }
            ]}
          >
            <View style={styles.formInputs}>
              <Text style={styles.stepTitle}>Tell us about yourself</Text>
              <View style={[styles.inputContainer, errors.firstName && styles.inputError]}>
                <MaterialCommunityIcons name="account" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="First Name"
                  placeholderTextColor="#999"
                  value={firstName}
                  onChangeText={(text) => {
                    setFirstName(text);
                    setErrors({ ...errors, firstName: undefined });
                  }}
                  autoCapitalize="words"
                />
              </View>
              {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}

              <View style={[styles.inputContainer, errors.lastName && styles.inputError]}>
                <MaterialCommunityIcons name="account" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Last Name"
                  placeholderTextColor="#999"
                  value={lastName}
                  onChangeText={(text) => {
                    setLastName(text);
                    setErrors({ ...errors, lastName: undefined });
                  }}
                  autoCapitalize="words"
                />
              </View>
              {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.formPage,
              {
                position: 'absolute',
                left: width,
                top: 0,
                transform: [{
                  translateX: slideAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -width]
                  })
                }]
              }
            ]}
          >
            <View style={styles.formInputs}>
              <Text style={styles.stepTitle}>Create your account</Text>

              <View style={[styles.inputContainer, errors.email && styles.inputError]}>
                <MaterialCommunityIcons name="email" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrors({ ...errors, email: undefined });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

              <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                <MaterialCommunityIcons name="lock" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrors({ ...errors, password: undefined });
                  }}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

              <View style={[styles.inputContainer, errors.confirmPassword && styles.inputError]}>
                <MaterialCommunityIcons name="lock" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrors({ ...errors, confirmPassword: undefined });
                  }}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

              {/* Referral Code Input */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="account-multiple-plus" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Referral Code (optional)"
                  placeholderTextColor="#999"
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                />
              </View>
            </View>
          </Animated.View>
        </>
      </Animated.View>

      <Animated.View style={[
        styles.bottomSection,
        {
          transform: [{
            translateY: heightAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 100] // Adjust based on your needs
            })
          }]
        }
      ]}>
        <TouchableOpacity
          style={styles.button}
          onPress={signupStep === 1 ? handleNextStep : () => handleAuth('signup')}
        >
          <Text style={styles.buttonText}>
            {signupStep === 1 ? 'Next' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <Animated.View style={[
          styles.backButtonContainer,
          {
            opacity: slideAnimation,
            transform: [{
              translateY: slideAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })
            }]
          }
        ]}>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={handlePrevStep}
          >
            <Text style={styles.buttonTextSecondary}>Back</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, signupStep === 2 && styles.stepDotInactive]} />
          <View style={[styles.stepDot, signupStep === 1 && styles.stepDotInactive]} />
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.googleButtonContainer}>
          <GoogleSignInComponent
            onSuccess={handleGoogleAuthResult}
            disabled={loading}
            mode="signup"
          />
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => {
            setIsLogin(true);
            setSignupStep(1);
          }}
        >
          <Text style={styles.switchText}>
            Already have an account? Login
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(translateY, {
        toValue: -e.endCoordinates.height / 3,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();
    });

    const hideSubscription = Keyboard.addListener('keyboardWillHide', () => {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return checkingAuth ? (<View style={[styles.container, styles.loadingContainer]}>
    <LinearGradient
      colors={theme.colors.gradient}
      style={StyleSheet.absoluteFill}
    />
    <ActivityIndicator size="large" color="#fff" />
  </View>) : (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <LinearGradient
          colors={theme.colors.gradient}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, {
            transform: [
              { translateY },
              {
                translateY: slideY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20]
                })
              }
            ],
            opacity
          }]}>
            <View style={styles.card}>
              <Image
                source={{ uri: 'https://api.a0.dev/assets/image?text=modern%20loyalty%20rewards%20app%20logo&aspect=1:1' }}
                style={styles.logo}
              />
              <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
              <View style={styles.form}>
                {isLogin ? (
                  <>
                    <View style={styles.inputContainer}>
                      <MaterialCommunityIcons name="email" size={20} color="#666" />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor="#999"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <MaterialCommunityIcons name="lock" size={20} color="#666" />
                      <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#999"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete="password"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.button, loading && styles.buttonDisabled]}
                      onPress={() => handleAuth(isLogin ? 'signin' : 'signup')}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>
                          {isLogin ? 'Sign In' : 'Sign Up'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <View style={styles.bottomSection}>
                      <View style={styles.dividerContainer}>
                        <View style={styles.divider} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.divider} />
                      </View>

                      <View style={styles.googleButtonContainer}>
                        <GoogleSignInComponent
                          onSuccess={handleGoogleAuthResult}
                          disabled={loading}
                          mode={isLogin ? 'signin' : 'signup'}
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.switchButton}
                        onPress={toggleAuthMode}
                      >
                        <Text style={styles.switchText}>
                          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  renderSignupStep()
                )}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logo: {
    width: 80, // Reduced from 120
    height: 80, // Reduced from 120
    marginBottom: 16, // Reduced from 30
    borderRadius: 40,
  },
  title: {
    fontSize: 24, // Reduced from 28
    fontWeight: 'bold',
    marginBottom: 20, // Reduced from 30
    color: '#333',
  },
  form: {
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  inputContainer: {
    minHeight: 46, // Slightly reduce height
    marginBottom: 8, // Reduce margin between inputs
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    height: 46, // Reduced from 50
    fontSize: 15, // Reduced from 16
    color: '#333',
    flex: 1,
    marginLeft: 10,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 12, // Slightly reduce padding for a more compact button
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8, // Reduce the margin between the button and the inputs
  },
  buttonDisabled: {
    backgroundColor: '#97a4c3',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomSection: {
    width: '100%',
    gap: 6, // Reduce gap between elements in the bottom section
    paddingTop: 8, // Slightly reduce top padding
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16, // Add specific top margin
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 8,
    color: '#888',
    fontSize: 16,
  },
  switchButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  googleButtonContainer: {
    width: '100%',
    marginVertical: 4, // Reduced margin
  },
  stepContainer: {
    width: '100%',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  stepDot: {
    width: 6, // Slightly smaller dots
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4c669f',
    marginHorizontal: 4,
  },
  stepDotInactive: {
    backgroundColor: '#ddd',
  },
  stepTitle: {
    fontSize: 20, // Reduced from 24
    fontWeight: '600',
    marginBottom: 16, // Reduced from 20
    color: '#333',
    textAlign: 'left',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 15,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    padding: 14, // Reduced from 16
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4c669f',
    marginTop: 4, // Reduced from 8
  },
  buttonTextSecondary: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  formWrapper: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  formContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 0, // Remove margin
  },
  formPage: {
    width: '100%',
  },
  formInputs: {
    gap: 6, // Reduce gap between inputs
    marginBottom: 12, // Add a slightly larger margin to separate inputs from the button
  },
  backButtonContainer: {
    position: 'absolute',
    top: 60, // Adjust based on your primary button height
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});