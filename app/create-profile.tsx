import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { CAMERA_TYPES } from '@/lib/cameraTypes';
import { errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { font, space } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Collected once, straight after sign-in. Name, email and camera type are required. */
export default function CreateProfile() {
  const { user, idToken, refreshUser } = useAuth();
  const { color } = useTheme();

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone_number ?? '');
  const [dob, setDob] = useState(user?.date_of_birth ?? '');
  const [cameraType, setCameraType] = useState<string | null>(user?.camera_type ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = !!firstName.trim() && EMAIL.test(email.trim()) && !!cameraType;
  const dobValid = !dob.trim() || DATE.test(dob.trim());

  const save = async () => {
    if (!idToken || !cameraType) return;
    setError(null);
    setBusy(true);
    try {
      await cloudApi.saveProfile(idToken, {
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        email: email.trim(),
        phone_number: phone.trim() || undefined,
        date_of_birth: dob.trim() || undefined,
        camera_type: cameraType,
      });
      await refreshUser();
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } catch (cause) {
      setError(errorMessage(cause, "We couldn't save your profile."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      onBack={router.canGoBack() ? () => router.back() : undefined}
      eyebrow="Your profile"
      title={user?.profile_completed ? 'Edit your profile' : 'Set up your profile'}
      subtitle="A few details so Zero Forg knows who it's protecting."
      footer={
        <Button
          label="Continue"
          onPress={save}
          disabled={!complete || !dobValid}
          loading={busy}
        />
      }
    >
      {error ? <Banner tone="error" title="Couldn't save" message={error} /> : null}

      <View style={styles.row}>
        <View style={styles.half}>
          <TextField
            label="First name"
            required
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            textContentType="givenName"
          />
        </View>
        <View style={styles.half}>
          <TextField
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            textContentType="familyName"
          />
        </View>
      </View>

      <TextField
        label="Email"
        required
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
      />

      <TextField
        label="Phone number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />

      <TextField
        label="Date of birth"
        value={dob}
        onChangeText={setDob}
        keyboardType="numbers-and-punctuation"
        hint={dobValid ? 'Format YYYY-MM-DD' : 'Use the format YYYY-MM-DD.'}
      />

      <View style={[styles.section, { borderTopColor: color.border }]}>
        <ChipGroup
          label="What are you connecting?"
          required
          options={CAMERA_TYPES}
          value={cameraType}
          onChange={setCameraType}
        />
        <Text style={[font.caption, { color: color.textMuted }]}>
          This tunes how Zero Forg discovers and connects your devices. You can change it later.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  section: { gap: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
