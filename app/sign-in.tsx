import { router } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Contours } from '@/components/Contours';
import { Glow } from '@/components/Glow';
import { Orb } from '@/components/Orb';
import { Pulse } from '@/components/Pulse';
import { Pill } from '@/components/Pill';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

export default function SignIn() {
  const { signInWithGoogle, sendOtp, googleReady, developmentMode } = useAuth();
  const { color } = useTheme();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<'google' | 'phone' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'google' | 'phone', action: () => Promise<void>) => {
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

  return (
    <View style={[styles.root, { backgroundColor: color.base }]}>
      <Glow y={0.22} size={1.3} opacity={0.5} />
      <Contours />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flow}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.toggleRow}>
          <ThemeToggle />
        </View>
        <Pressable style={styles.hero} onPress={Keyboard.dismiss}>
          <Pill label="Zero Forg Vision" tone="accent" dot />
          <Pulse duration={4200} min={0.72}>
            <Orb size={200} />
          </Pulse>
          <View style={styles.copy}>
            <Text style={[font.display, styles.headline, { color: color.text }]}>
              Every camera,{'\n'}
              <Text style={{ color: color.accent }}>one intelligence.</Text>
            </Text>
            <Text style={[font.body, styles.lede, { color: color.textMuted }]}>
              Sign in to discover and connect the cameras on your network.
            </Text>
          </View>
        </Pressable>

        <View style={styles.panel}>
          {error ? <Banner tone="error" title="Couldn't sign in" message={error} /> : null}

          <Button
            label="Continue with Google"
            onPress={() =>
              run('google', async () => {
                await signInWithGoogle();
                router.replace('/');
              })
            }
            disabled={!googleReady}
            loading={busy === 'google'}
          />

          <View style={styles.divider}>
            <View style={[styles.rule, { backgroundColor: color.border }]} />
            <Text style={[font.eyebrow, styles.dividerText, { color: color.textFaint }]}>
              or continue with phone
            </Text>
            <View style={[styles.rule, { backgroundColor: color.border }]} />
          </View>

          <TextField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <Button
            label="Send verification code"
            variant="secondary"
            onPress={() =>
              run('phone', async () => {
                await sendOtp(phone.trim());
                router.push({ pathname: '/verify-otp', params: { phone: phone.trim() } });
              })
            }
            disabled={phone.trim().length < 8}
            loading={busy === 'phone'}
          />

          {developmentMode ? (
            <Banner tone="info" title="Development mode" />
          ) : null}
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flow: { flex: 1, justifyContent: 'space-between' },
  toggleRow: { alignItems: 'flex-end', paddingHorizontal: space.xl, paddingTop: space.sm },
  hero: { alignItems: 'center', paddingTop: space.sm, paddingHorizontal: space.xl, gap: space.lg },
  copy: { gap: space.sm, alignItems: 'center' },
  headline: { textAlign: 'center' },
  lede: { textAlign: 'center', maxWidth: 300 },
  panel: { padding: space.xl, gap: space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 10 },
});
