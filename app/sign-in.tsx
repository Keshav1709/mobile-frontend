import { router } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Contours } from '@/components/Contours';
import { Divider } from '@/components/Divider';
import { Glow } from '@/components/Glow';
import { Orb } from '@/components/Orb';
import { Pill } from '@/components/Pill';
import { Pulse } from '@/components/Pulse';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Busy = 'email' | 'google' | null;

/**
 * Sign in with the account your administrator created on the dashboard.
 * There is no sign-up here: the app and the dashboard share one user base.
 */
export default function SignIn() {
  const { signInWithEmail, signInWithGoogle, googleAvailable, googleReady, developmentMode } = useAuth();
  const { color } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    if (busy) return;
    setError(null);
    setBusy(kind);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause, 'Sign-in failed. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  // Enabled as soon as both fields have something in them. The address is
  // checked on submit, where a typo can be explained, rather than by greying
  // the button out and leaving the person to guess what is wrong.
  const emailReady = email.trim().length > 0 && password.length > 0;

  const submitEmail = () => {
    const address = email.trim();
    if (!EMAIL.test(address)) {
      setError('Enter a valid email address, like name@example.com.');
      return;
    }
    run('email', async () => {
      await signInWithEmail(address, password);
      router.replace('/');
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: color.base }]}>
      <Glow y={0.18} size={1.3} opacity={0.5} />
      <Contours />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.hero} onPress={Keyboard.dismiss}>
              <Pill label="Zero Forg Vision" tone="accent" dot />
              <Pulse duration={4200} min={0.72}>
                <Orb size={150} />
              </Pulse>
              <View style={styles.copy}>
                <Text style={[font.display, styles.headline, { color: color.text }]}>
                  Every camera,{'\n'}
                  <Text style={{ color: color.accent }}>one intelligence.</Text>
                </Text>
                <Text style={[font.body, styles.lede, { color: color.textMuted }]}>
                  Industrial Intelligence System
                </Text>
              </View>
            </Pressable>

            <View style={styles.panel}>
              {error ? <Banner tone="error" title="Couldn't sign in" message={error} /> : null}

              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="username"
                placeholder="name@example.com"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secure
                autoComplete="current-password"
                textContentType="password"
                placeholder="Your password"
                returnKeyType="go"
                onSubmitEditing={() => emailReady && submitEmail()}
              />
              <Button
                label="Sign in"
                onPress={submitEmail}
                disabled={!emailReady}
                loading={busy === 'email'}
              />

              {googleAvailable ? (
                <>
                  <Divider label="or continue with" />
                  <Button
                    label="Google"
                    variant="secondary"
                    onPress={() =>
                      run('google', async () => {
                        await signInWithGoogle();
                        router.replace('/');
                      })
                    }
                    disabled={!googleReady}
                    loading={busy === 'google'}
                  />
                </>
              ) : null}

              {developmentMode ? <Banner tone="info" title="Development mode" /> : null}

              <Text style={[font.caption, styles.note, { color: color.textFaint }]}>
                Accounts are created by your administrator on the Zero Forg dashboard.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingTop: space.xl, paddingHorizontal: space.xl, gap: space.md },
  copy: { gap: space.xs, alignItems: 'center' },
  headline: { textAlign: 'center', fontSize: 28, lineHeight: 34 },
  lede: { textAlign: 'center', maxWidth: 300 },
  panel: { padding: space.xl, gap: space.md },
  note: { textAlign: 'center', paddingTop: space.sm },
});
