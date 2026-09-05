import { GlassCarousel, GlassSlide } from '@/components/GlassCarousel';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/state/auth';
import { hue } from '@/theme';

export default function Profile() {
  const { user, signOut } = useAuth();

  const slides: GlassSlide[] = [
    {
      key: 'identity',
      title: 'Identity',
      tint: hue.violet,
      rows: [
        { label: 'First name', value: user?.first_name },
        { label: 'Last name', value: user?.last_name },
        { label: 'Date of birth', value: user?.date_of_birth },
      ],
    },
    {
      key: 'contact',
      title: 'Contact',
      tint: hue.blue,
      rows: [
        { label: 'Email', value: user?.email },
        { label: 'Phone', value: user?.phone_number },
        { label: 'Signed in with', value: user?.auth_provider },
      ],
    },
    {
      key: 'account',
      title: 'Account',
      tint: hue.teal,
      rows: [
        { label: 'Camera type', value: user?.camera_type },
        { label: 'Organisation', value: user?.tenant_id },
        { label: 'User ID', value: user?.user_id },
      ],
    },
  ];

  return (
    <Screen
      eyebrow="Your account"
      title={user?.display_name ?? 'Profile'}
      subtitle={user?.email ?? user?.phone_number ?? undefined}
      footer={<Button label="Sign out" variant="secondary" onPress={signOut} />}
    >
      <GlassCarousel slides={slides} />
    </Screen>
  );
}
