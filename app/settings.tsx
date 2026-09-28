import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { ListGroup, ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cacheAvailable } from '@/lib/cache';
import { confirmSignOut, goBack } from '@/lib/helpers';
import { useAuth } from '@/state/auth';
import { useNotifications } from '@/state/notifications';
import { ThemeMode, useTheme } from '@/state/theme';
import { space } from '@/theme';

const APPEARANCE: { label: string; mode: ThemeMode }[] = [
  { label: 'Light', mode: 'light' },
  { label: 'Dark', mode: 'dark' },
  { label: 'Automatic', mode: 'auto' },
];

const PROVIDER: Record<string, string> = {
  password: 'Email and password',
  'google.com': 'Google',
  phone: 'Phone number',
  dev: 'Development sign-in',
};

export default function Settings() {
  const { user, signOut } = useAuth();
  const { mode, setMode } = useTheme();
  const { permission, token, tokenKind, request } = useNotifications();

  const alertsState =
    permission === 'granted'
      ? token
        ? 'On'
        : 'On, no token yet'
      : permission === 'denied'
        ? 'Off'
        : 'Not set up';

  return (
    <Screen
      onBack={() => goBack('/(tabs)')}
      eyebrow="Admin"
      title="Settings"
      footer={<Button label="Sign out" variant="danger" onPress={() => confirmSignOut(signOut)} />}
    >
      <View style={styles.appearance}>
        <ChipGroup
          label="Appearance"
          options={APPEARANCE.map((option) => option.label)}
          value={APPEARANCE.find((option) => option.mode === mode)?.label ?? 'Dark'}
          onChange={(label) => {
            const chosen = APPEARANCE.find((option) => option.label === label);
            if (chosen) setMode(chosen.mode);
          }}
        />
        <ThemeToggle />
      </View>

      <ListGroup title="Facility">
        <ListRow icon="areas" label="Camera areas" hint="Outline what matters on each camera" onPress={() => router.push('/zones')} />
        <ListRow icon="cameras" label="Add a camera" onPress={() => router.push('/onboarding')} />
      </ListGroup>

      <ListGroup title="Alerts">
        <ListRow
          icon="alerts"
          label="Alerts on this phone"
          value={alertsState}
          hint={
            permission === 'denied'
              ? 'Turn notifications on for Zero Forg in your phone settings to get alerts when the app is closed.'
              : 'Camera alerts arrive even when the app is closed.'
          }
          onPress={permission === 'granted' ? undefined : () => void request()}
        />
        {/* Read during backend bring-up: nothing sends to this device yet. */}
        {token ? (
          <ListRow
            label={`Device token (${tokenKind})`}
            value={`${token.slice(0, 12)}…${token.slice(-6)}`}
          />
        ) : null}
      </ListGroup>

      <ListGroup title="This app">
        <ListRow
          icon="cloud"
          label="Offline memory"
          value={cacheAvailable() ? 'On' : 'Unavailable'}
          hint={
            cacheAvailable()
              ? 'Your cameras and their last pictures are kept on this phone, so the app opens with something to show.'
              : 'This build cannot save anything between launches, so every screen starts empty. Reinstall the latest build to fix it.'
          }
        />
      </ListGroup>

      <ListGroup title="Workspace">
        <ListRow label="Workspace" value={user?.tenant_name ?? user?.tenant_id} hint={user?.tenant_id ?? undefined} />
      </ListGroup>

      <ListGroup title="Account">
        <ListRow icon="profile" label="Edit profile" onPress={() => router.push('/create-profile')} />
        <ListRow label="Name" value={user?.display_name} />
        <ListRow label="Email" value={user?.email} />
        <ListRow label="Phone" value={user?.phone_number} />
        <ListRow label="Signed in with" value={PROVIDER[user?.auth_provider ?? ''] ?? user?.auth_provider} />
      </ListGroup>

    </Screen>
  );
}

const styles = StyleSheet.create({
  appearance: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
});
