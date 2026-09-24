/**
 * Every icon the app uses, by meaning. One place to change a glyph, and the
 * names are Ionicons (bundled with Expo), so they render the same on every OS.
 */
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const icons = {
  menu: 'menu-outline',
  back: 'chevron-back',
  forward: 'chevron-forward',
  close: 'close',
  home: 'home-outline',
  homeActive: 'home',
  live: 'videocam-outline',
  liveActive: 'videocam',
  cameras: 'add-circle-outline',
  areas: 'shapes-outline',
  ai: 'sparkles-outline',
  alerts: 'notifications-outline',
  profile: 'person-circle-outline',
  setup: 'flag-outline',
  settings: 'settings-outline',
  signOut: 'log-out-outline',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',
  warning: 'alert-circle',
  info: 'information-circle-outline',
  refresh: 'refresh',
  expand: 'chevron-down',
  collapse: 'chevron-up',
  camera: 'camera-outline',
  box: 'hardware-chip-outline',
  wifi: 'wifi-outline',
  cloud: 'cloud-outline',
  key: 'key-outline',
  trash: 'trash-outline',
  edit: 'create-outline',
  draw: 'pencil-outline',
  undo: 'arrow-undo-outline',
  eye: 'eye-outline',
  eyeOff: 'eye-off-outline',
  sun: 'sunny',
  moon: 'moon',
  offline: 'cloud-offline-outline',
  search: 'search-outline',
  play: 'play',
  fullscreen: 'expand-outline',
} as const satisfies Record<string, IconName>;

export type IconKey = keyof typeof icons;
