import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  required?: boolean;
  secure?: boolean;
};

export function TextField({ label, hint, required, secure, style, ...input }: Props) {
  const { color } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={[font.eyebrow, { color: color.textFaint }]}>
        {label}
        {required ? <Text style={{ color: color.danger }}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: focused ? color.surfaceRaised : color.surface,
            borderColor: focused ? color.accent : color.border,
          },
        ]}
      >
        <TextInput
          {...input}
          style={[font.body, styles.input, { color: color.text }, style]}
          secureTextEntry={secure && !revealed}
          placeholderTextColor={color.textFaint}
          selectionColor={color.accent}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((value) => !value)}
            hitSlop={10}
          >
            <Text style={[font.eyebrow, styles.toggle, { color: color.accent }]}>
              {revealed ? 'HIDE' : 'SHOW'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={[font.caption, { color: color.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 54,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: { flex: 1, padding: 0 },
  toggle: { fontSize: 10 },
});
