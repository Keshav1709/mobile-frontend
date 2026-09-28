import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Pill } from '@/components/Pill';
import { IconKey } from '@/lib/icons';
import { confirmSignOut } from '@/lib/helpers';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/state/auth';
import { useConsole } from '@/state/console';
import { ThemeReveal, useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

const WIDTH = Math.min(320, Dimensions.get('window').width * 0.84);

type Section = { title: string; items: Item[] };

type Item = {
  icon: IconKey;
  label: string;
  route: string;
  writes?: boolean;
  /** Hidden unless the workspace has one of these capabilities switched on. */
  needs?: string[];
  /** Hidden unless this login holds this permission in the selected organisation. */
  perm?: string;
};

/**
 * The dashboard's sidebar, as the app's drawer.
 *
 * Items marked `writes` change something on the dashboard. Against a read-only
 * registry they are left out entirely: offering "Add a camera" only to refuse
 * on the last screen is worse than not offering it.
 */
const SECTIONS: Section[] = [
  {
    title: 'Monitor',
    items: [
      { icon: 'home', label: 'Home', route: '/(tabs)' },
      { icon: 'live', label: 'Live', route: '/(tabs)/live', perm: 'live.view' },
      { icon: 'cameras', label: 'Add a camera', route: '/onboarding', writes: true, perm: 'cameras.manage' },
      { icon: 'areas', label: 'Areas', route: '/zones', perm: 'cameras.manage' },
    ],
  },
  {
    // Computed by the registry from the dashboard's own tables — see
    // `api/dashboard.ts`. They read the same workspace the rest of the app does.
    title: 'Insights',
    items: [
      {
        icon: 'profile',
        label: 'Attendance',
        route: '/attendance',
        needs: ['attendance_board', 'attendance'],
        perm: 'people.view',
      },
      {
        icon: 'search',
        label: 'Faces',
        route: '/people',
        needs: ['find_person', 'unknown_faces', 'attendance'],
        perm: 'people.view',
      },
      { icon: 'ai', label: 'Mira', route: '/mira', perm: 'mira.use' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { icon: 'alerts', label: 'Alerts', route: '/(tabs)/alerts', perm: 'alerts.view' },
      { icon: 'info', label: 'Reports', route: '/reports', perm: 'reports.view' },
      { icon: 'play', label: 'Recordings', route: '/recordings', perm: 'recordings.view' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { icon: 'profile', label: 'Profile', route: '/(tabs)/profile' },
      { icon: 'cloud', label: 'Workspace', route: '/workspace' },
      // Read-only since binding moved to the dashboard, so no write gate: a
      // viewer should still be able to see whether the box is up.
      { icon: 'box', label: 'ZeroForg Box', route: '/box' },
      { icon: 'settings', label: 'App settings', route: '/settings' },
    ],
  },
];

export function AppMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { color, gradient } = useTheme();
  const { user, signOut, readOnly } = useAuth();
  const { can, orgName, canSwitchOrg, organizations, orgId, selectOrg, status } = useConsole();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  /** The site list under the drawer header, closed until asked for. */
  const [sitesOpen, setSitesOpen] = useState(false);
  const slide = useRef(new Animated.Value(-WIDTH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: -WIDTH,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        setMounted(false);
        // Dismissing by the backdrop leaves the site list open otherwise, and
        // the drawer reopens already expanded over the rest of the menu.
        setSitesOpen(false);
      });
    }
  }, [visible, mounted, slide, backdrop]);

  if (!mounted) return null;

  const go = (route: string) => {
    setSitesOpen(false);
    onClose();
    router.push(route as never);
  };

  /**
   * Switching site reloads the manifest, and with it permissions, the camera
   * list and every screen's data. Close the drawer so the person lands on a
   * refreshed screen rather than watching it change underneath an open menu.
   */
  const chooseSite = async (id: string) => {
    setSitesOpen(false);
    onClose();
    if (id !== orgId) await selectOrg(id);
  };

  const leave = () => {
    onClose();
    confirmSignOut(signOut);
  };

  // The workspace and the person are two different things: the drawer's
  // header names the workspace the dashboard put this account in, and the
  // footer names whoever is signed in. Accounts often have no display name,
  // so the footer falls back to the e-mail rather than to a generic label.
  // Two reasons to drop an item: a read-only registry cannot perform it, or
  // this workspace does not have the feature at all. TRZ has no attendance
  // board and no face gallery, and an entry that can only lead to "not
  // enabled" is worse than no entry.
  // Three reasons to drop an item, and the third is the one that matters most:
  // this login may simply not be allowed to do it in this organisation. A viewer
  // has no Setup; a member cannot change alert rules. Permissions are per-org and
  // come from the manifest, so they are re-read whenever the site changes.
  const features = new Set(user?.features ?? []);
  const sections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        !(readOnly && item.writes) &&
        (!item.needs || item.needs.some((key) => features.has(key))) &&
        (!item.perm || can(item.perm)),
    ),
  })).filter((section) => section.items.length);

  // The manifest names the organisation actually being read; the profile's copy is
  // the account's default and can differ once a site has been switched.
  const workspace = orgName?.trim() || user?.tenant_name?.trim() || 'No workspace';
  const name = user?.display_name?.trim() || user?.email?.trim() || 'Your account';
  const contact = user?.email ?? user?.phone_number ?? '';

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: color.surface, borderRightColor: color.border, transform: [{ translateX: slide }] },
        ]}
      >
        <View style={[styles.safe, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.brand}>
            <LinearGradient colors={gradient.mark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mark} />
            <Text style={[font.eyebrow, { color: color.textFaint }]}>Zero Forg</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={canSwitchOrg ? { expanded: sitesOpen } : undefined}
            accessibilityLabel={
              canSwitchOrg ? `${workspace}. Switch site` : `${workspace}. Open workspace`
            }
            onPress={() =>
              canSwitchOrg ? setSitesOpen((open) => !open) : go('/(tabs)/profile')
            }
            style={[styles.workspace, { backgroundColor: color.surfaceRaised, borderColor: color.border }]}
          >
            <View style={[styles.avatar, { backgroundColor: color.accentSoft }]}>
              <Text style={[font.heading, { color: color.accent }]}>
                {workspace.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.workspaceText}>
              <Text numberOfLines={1} style={[font.heading, { color: color.text }]}>{workspace}</Text>
              <Pill label={canSwitchOrg ? 'Switch site' : 'Workspace'} tone="accent" />
            </View>
            <Icon
              name={canSwitchOrg ? (sitesOpen ? 'collapse' : 'expand') : 'forward'}
              size={18}
              color={color.textFaint}
            />
          </Pressable>

          {canSwitchOrg && sitesOpen ? (
            <View style={[styles.sites, { backgroundColor: color.surface, borderColor: color.border }]}>
              {organizations.map((org) => {
                const id = org.orgId ?? org.id;
                const active = id === orgId;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: status === 'loading' }}
                    disabled={status === 'loading'}
                    onPress={() => void chooseSite(id)}
                    style={({ pressed }) => [
                      styles.siteRow,
                      {
                        backgroundColor: pressed || active ? color.accentSoft : 'transparent',
                        borderBottomColor: color.border,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[font.body, styles.fill, { color: active ? color.accent : color.text }]}
                    >
                      {org.name}
                    </Text>
                    {active ? <Icon name="checkCircle" size={16} color={color.accent} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <ScrollView contentContainerStyle={styles.sections} showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={[font.eyebrow, styles.sectionTitle, { color: color.textFaint }]}>{section.title}</Text>
                {section.items.map((item) => (
                  <Pressable
                    key={item.label}
                    accessibilityRole="button"
                    onPress={() => go(item.route)}
                    style={({ pressed }) => [
                      styles.item,
                      { backgroundColor: pressed ? color.accentSoft : 'transparent' },
                    ]}
                  >
                    <View style={[styles.glyphWrap, { backgroundColor: color.surfaceRaised, borderColor: color.border }]}>
                      <Icon name={item.icon} size={18} color={color.accent} />
                    </View>
                    <Text style={[font.body, { color: color.text }]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: color.border }]}>
            <Pressable accessibilityRole="button" onPress={() => go('/(tabs)/profile')} style={styles.user}>
              <LinearGradient colors={gradient.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userAvatar}>
                <Text style={[font.label, { color: color.white }]}>{name.slice(0, 1).toUpperCase()}</Text>
              </LinearGradient>
              <View style={styles.userText}>
                <Text numberOfLines={1} style={[font.label, { color: color.text }]}>{name}</Text>
                <Text numberOfLines={1} ellipsizeMode="middle" style={[font.caption, { color: color.textMuted }]}>
                  {contact}
                </Text>
              </View>
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={[font.caption, { color: color.textMuted }]}>Appearance</Text>
              <ThemeToggle />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={leave}
              style={({ pressed }) => [
                styles.signOut,
                { borderColor: color.dangerSoft, backgroundColor: pressed ? color.dangerSoft : 'transparent' },
              ]}
            >
              <Icon name="signOut" size={18} color={color.danger} />
              <Text style={[font.label, { color: color.danger }]}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
      <ThemeReveal />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  safe: { flex: 1 },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
  },
  mark: { width: 18, height: 18, borderRadius: 5 },
  sites: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fill: { flex: 1 },
  workspace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  workspaceText: { flex: 1, gap: 6 },
  sections: { paddingHorizontal: space.md, paddingVertical: space.lg, gap: space.lg },
  section: { gap: 2 },
  sectionTitle: { paddingHorizontal: space.md, marginBottom: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  glyphWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  user: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  userAvatar: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  userText: { flex: 1, gap: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
