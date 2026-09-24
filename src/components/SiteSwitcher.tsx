import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/Banner';
import { useConsole } from '@/state/console';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

/**
 * Which site this login is looking at.
 *
 * Two different choices, and only the first is about access:
 *
 *   Site      — a centre / factory. The list is GET /realm, which the server filters by
 *               membership, so it holds exactly the centres this login was given (its
 *               own, plus anything inherited from a group above it). It renders only
 *               when there is more than one. Nothing here decides access; the server
 *               already did, and the app only draws what it was handed.
 *
 *   Location  — a place inside the selected centre. Narrows what screens ask for. It is
 *               a filter, never identity, and never changes what may be read.
 *
 * With one centre and one location this draws nothing at all, which is the common case
 * and the point: most people never learn that either concept exists.
 */
export function SiteSwitcher() {
  const { color } = useTheme();
  const {
    organizations,
    orgId,
    canSwitchOrg,
    sites,
    siteId,
    canSwitchSite,
    selectOrg,
    selectSite,
    status,
    error,
  } = useConsole();

  if (!canSwitchOrg && !canSwitchSite && !error) return null;

  const busy = status === 'loading';

  return (
    <View style={styles.wrap}>
      {error ? <Banner tone="error" title="Site" message={error} /> : null}

      {canSwitchOrg ? (
        <View style={styles.group}>
          <Text style={[font.eyebrow, { color: color.textFaint }]}>Site</Text>
          <View style={styles.chips}>
            {organizations.map((org) => {
              const id = org.orgId ?? org.id;
              const active = id === orgId;
              return (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: busy }}
                  disabled={busy}
                  onPress={() => void selectOrg(id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? color.accentSoft : color.surface,
                      borderColor: active ? color.accent : color.border,
                      opacity: busy && !active ? 0.5 : 1,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[font.label, { color: active ? color.accent : color.textMuted }]}
                  >
                    {org.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {canSwitchSite ? (
        <View style={styles.group}>
          <Text style={[font.eyebrow, { color: color.textFaint }]}>Location</Text>
          <View style={styles.chips}>
            {[{ id: null, name: 'All locations' }, ...sites].map((site) => {
              const active = site.id === siteId;
              return (
                <Pressable
                  key={site.id ?? 'all'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => selectSite(site.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? color.accentSoft : color.surface,
                      borderColor: active ? color.accent : color.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[font.label, { color: active ? color.accent : color.textMuted }]}
                  >
                    {site.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 260,
  },
});
