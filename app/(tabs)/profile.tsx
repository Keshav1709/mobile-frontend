import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { DetailList } from '@/components/DetailList';
import { Pill } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import { CAMERA_TYPES } from '@/lib/cameraTypes';
import { confirmSignOut, errorMessage } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { family, font, radius, space } from '@/theme';

/** How the account was created, in words rather than a provider id. */
const PROVIDER: Record<string, string> = {
  'google.com': 'Google',
  phone: 'Phone number',
  password: 'Email and password',
  dev: 'Development sign-in',
};

export default function Profile() {
  const { user, signOut, idToken, refreshUser, readOnly, registryOffline } = useAuth();
  const { color, gradient } = useTheme();

  const [editingType, setEditingType] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contact = user?.email ?? user?.phone_number ?? undefined;
  const provider = PROVIDER[user?.auth_provider ?? ''] ?? 'Unknown';

  const changeCameraType = async (camera_type: string) => {
    if (!idToken) return;
    setSaving(true);
    setError(null);
    try {
      await cloudApi.saveProfile(idToken, { camera_type });
      await refreshUser();
      setEditingType(false);
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't save that change."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      tabBar
      eyebrow="Your account"
      title="Profile"
      footer={
        <>
          {/* Name, phone and e-mail belong to the dashboard account; only
              the app's own preferences can be edited from here. */}
          {readOnly ? null : (
            <Button
              label="Edit details"
              variant="secondary"
              onPress={() => router.push('/create-profile')}
            />
          )}
          <Button label="Camera areas" variant="secondary" onPress={() => router.push('/zones')} />
          <Button label="Sign out" variant="ghost" onPress={() => confirmSignOut(signOut)} />
        </>
      }
    >
      <View style={styles.hero}>
        <LinearGradient
          colors={gradient.accent}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={[styles.initials, { color: color.white }]}>{initials(user)}</Text>
        </LinearGradient>

        <View style={styles.identity}>
          <Text numberOfLines={1} style={[font.title, { color: color.text }]}>
            {user?.display_name ?? 'Your profile'}
          </Text>
          {contact ? (
            <Text numberOfLines={1} style={[font.body, { color: color.textMuted }]}>
              {contact}
            </Text>
          ) : null}
          <View style={styles.badges}>
            <Pill label={provider} tone="accent" />
          </View>
        </View>
      </View>

      {registryOffline ? (
        <Banner
          tone="info"
          title="Signed in through the dashboard"
          message="The app's own service couldn't be reached, so camera type and date of birth aren't available right now. Everything else is up to date."
        />
      ) : null}
      {error ? <Banner tone="error" title="Couldn't save" message={error} /> : null}

      {editingType ? (
        <View style={styles.editor}>
          <ChipGroup
            label="Camera type"
            options={CAMERA_TYPES}
            value={user?.camera_type ?? null}
            onChange={changeCameraType}
          />
          <Button
            label={saving ? 'Saving…' : 'Cancel'}
            variant="ghost"
            loading={saving}
            onPress={() => setEditingType(false)}
          />
        </View>
      ) : (
        <View style={styles.group}>
          <Text style={[font.eyebrow, { color: color.textFaint }]}>Camera type</Text>
          <Button
            label={user?.camera_type ?? 'Choose a camera type'}
            variant="secondary"
            onPress={() => setEditingType(true)}
          />
        </View>
      )}

      <DetailList
        title="Details"
        rows={[
          { label: 'First name', value: user?.first_name },
          { label: 'Last name', value: user?.last_name },
          { label: 'Date of birth', value: formatDate(user?.date_of_birth) },
        ]}
      />

      <DetailList
        title="Contact"
        rows={[
          { label: 'Email', value: user?.email },
          { label: 'Phone', value: user?.phone_number },
        ]}
      />

      <DetailList
        title="Account"
        rows={[
          { label: 'Organisation', value: user?.tenant_name ?? user?.tenant_id },
          { label: 'Member since', value: formatDate(user?.created_at?.slice(0, 10)) },
        ]}
      />
    </Screen>
  );
}

function initials(user: { first_name?: string | null; last_name?: string | null } | null): string {
  const letters = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('');
  return letters.toUpperCase() || '·';
}

/** 2002-04-11 reads better as 11 April 2002. */
function formatDate(value?: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value ?? null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingTop: space.xs },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 26, fontFamily: family.bold, letterSpacing: 0.5 },
  identity: { flex: 1, gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  group: { gap: space.md },
  editor: { gap: space.md },
});
