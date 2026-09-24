import { Image } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, radius } from '@/theme';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Someone's enrolment photo, or their initials when there is none.
 *
 * `present` desaturates the absent: on the board a face you can see is someone
 * in the building, and everybody else recedes. Photos are signed URLs that
 * expire, so a failure has to degrade to initials rather than a broken image.
 */
export function Face({
  name,
  photo,
  present = true,
  size = 46,
}: {
  name: string;
  photo?: string | null;
  present?: boolean;
  size?: number;
}) {
  const { color } = useTheme();
  const frame = {
    width: size,
    height: size,
    borderRadius: radius.pill,
    borderColor: present ? color.accentLine : color.border,
  };

  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[styles.face, frame, !present && styles.away]}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View
      style={[
        styles.face,
        styles.center,
        frame,
        { backgroundColor: present ? color.accentSoft : color.surfaceSunken },
      ]}
    >
      <Text style={[font.label, { color: present ? color.accent : color.textFaint }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { borderWidth: StyleSheet.hairlineWidth },
  center: { alignItems: 'center', justifyContent: 'center' },
  // Absent people are still shown, just quietened.
  away: { opacity: 0.38 },
});
