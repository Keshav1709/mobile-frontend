import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { cloudApi } from '@/api/cloud';
import { Camera } from '@/api/types';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ZoneCanvas, ZoneCanvasMode } from '@/components/ZoneCanvas';
import { haptic } from '@/lib/haptics';
import { errorMessage, goBack } from '@/lib/helpers';
import {
  AREA_CHIP_OPTIONS,
  AreaChip,
  Point,
  ZonePolygon,
  labelZone,
  newZone,
} from '@/lib/zones';
import { frameSource, streamNames } from '@/onvif/relay';
import { useAgent } from '@/state/agent';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';
import { useToast } from '@/state/toast';
import { font, radius, space } from '@/theme';

/**
 * Outline areas on one camera. Same flow as the dashboard's ZoneEditorPanel:
 * pick what the area is, draw it, save. Areas are saved to the registry and
 * picked up by the box on its next config poll.
 */
export default function ZoneEditor() {
  const { cameraId } = useLocalSearchParams<{ cameraId: string }>();
  const { color } = useTheme();
  const { user, idToken, readOnly } = useAuth();
  const { relayUrl } = useAgent();
  const toast = useToast();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [zones, setZones] = useState<ZonePolygon[]>([]);
  const [savedZones, setSavedZones] = useState<ZonePolygon[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [mode, setMode] = useState<ZoneCanvasMode>('idle');
  const [drawing, setDrawing] = useState<Point[]>([]);
  const [areaLabel, setAreaLabel] = useState<AreaChip>('Entrance');
  const [customLabel, setCustomLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const camera = useMemo(
    () => cameras.find((item) => item.camera_id === cameraId) ?? null,
    [cameras, cameraId],
  );
  // The relay needs credentials for this frame, so it travels as a full image
  // source with headers rather than a bare URL.
  const image = useMemo(
    () =>
      relayUrl && camera?.stream_reference
        ? frameSource(streamNames(camera.camera_id).preview)
        : null,
    [camera, relayUrl],
  );

  const load = useCallback(async () => {
    if (!user || !idToken || !cameraId) return;
    setLoading(true);
    try {
      const [list, current] = await Promise.all([
        cloudApi.listCameras(idToken),
        cloudApi.getCameraZones(idToken, cameraId),
      ]);
      setCameras(list);
      setZones(current.zones);
      setSavedZones(current.zones);
      setActiveZoneId(null);
      setMode('idle');
      setDrawing([]);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't load this camera's areas."));
    } finally {
      setLoading(false);
    }
  }, [user, idToken, cameraId]);

  useEffect(() => {
    load();
  }, [load]);

  const resolvedLabel = areaLabel === 'Custom' ? customLabel.trim() || 'Custom' : areaLabel;
  const dirty = JSON.stringify(zones) !== JSON.stringify(savedZones);
  const active = zones.find((zone) => zone.id === activeZoneId) ?? null;

  const startDrawing = () => {
    setMode('draw');
    setActiveZoneId(null);
    setDrawing([]);
  };

  const cancelDrawing = () => {
    setMode('idle');
    setDrawing([]);
  };

  const closeDrawing = (points: Point[]) => {
    if (points.length < 3) return;
    haptic.select();
    const zone = labelZone(newZone(points, zones.length), resolvedLabel);
    setZones((current) => [...current, zone]);
    setActiveZoneId(zone.id);
    setDrawing([]);
    setMode('idle');
  };

  const updateActive = (patch: Partial<ZonePolygon>) => {
    if (!active) return;
    setZones((current) =>
      current.map((zone) => (zone.id === active.id ? { ...zone, ...patch } : zone)),
    );
  };

  const removeZone = (id: string) => {
    setZones((current) => current.filter((zone) => zone.id !== id));
    if (activeZoneId === id) setActiveZoneId(null);
  };

  const save = async () => {
    if (!idToken || !cameraId) return;
    setSaving(true);
    setError(null);
    try {
      const result = await cloudApi.updateCameraZones(idToken, cameraId, zones);
      setZones(result.zones);
      setSavedZones(result.zones);
      haptic.success();
      toast.show('Areas saved. Your box picks them up on its next check-in.');
    } catch (cause) {
      haptic.error();
      setError(errorMessage(cause, 'Could not save areas'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      onBack={() => goBack('/zones')}
      eyebrow="Areas"
      title={camera?.display_name ?? 'Camera'}
      subtitle="Outline areas on this camera"
      footer={
        <>
          {/* Areas are the dashboard's to change. Without a save there is
              nothing for the drawing tools to do, so the screen becomes what
              it can honestly be: a view of the areas already outlined. */}
          <Button
            label={
              readOnly
                ? 'Areas are edited on the dashboard'
                : saving
                  ? 'Saving…'
                  : dirty
                    ? 'Save areas'
                    : 'Areas saved'
            }
            onPress={save}
            disabled={readOnly || saving || !dirty}
            loading={saving}
          />
          {mode === 'draw' ? (
            <View style={styles.drawActions}>
              <View style={styles.flex}>
                <Button
                  label="Undo point"
                  variant="secondary"
                  onPress={() => setDrawing((current) => current.slice(0, -1))}
                  disabled={drawing.length === 0}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Close area"
                  variant="secondary"
                  onPress={() => closeDrawing(drawing)}
                  disabled={drawing.length < 3}
                />
              </View>
              <View style={styles.flex}>
                <Button label="Cancel" variant="ghost" onPress={cancelDrawing} />
              </View>
            </View>
          ) : (
            <Button label="Draw area" variant="secondary" onPress={startDrawing} />
          )}
        </>
      }
    >
      {error ? (
        <Banner
          tone="error"
          title="Something went wrong"
          message={error}
          onRetry={() => void load()}
        />
      ) : null}

      {cameras.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {cameras.map((item) => {
            const current = item.camera_id === cameraId;
            return (
              <Pressable
                key={item.camera_id}
                accessibilityRole="tab"
                accessibilityState={{ selected: current }}
                onPress={() => router.setParams({ cameraId: item.camera_id })}
                style={[
                  styles.tab,
                  {
                    backgroundColor: current ? color.accentSoft : color.surface,
                    borderColor: current ? color.accent : color.border,
                  },
                ]}
              >
                <Text style={[font.label, { color: current ? color.accent : color.textMuted }]}>
                  {item.display_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ChipGroup
        label="What is this area?"
        options={AREA_CHIP_OPTIONS}
        value={areaLabel}
        onChange={(value) => setAreaLabel(value as AreaChip)}
      />
      {areaLabel === 'Custom' ? (
        <TextField label="Name this area" value={customLabel} onChangeText={setCustomLabel} />
      ) : null}

      <ZoneCanvas
        image={image}
        zones={zones}
        activeZoneId={activeZoneId}
        mode={mode}
        drawing={drawing}
        onDrawingChange={setDrawing}
        onClose={closeDrawing}
        onActiveZoneChange={setActiveZoneId}
      />

      <Text style={[font.caption, { color: color.textMuted }]}>
        {mode === 'draw'
          ? drawing.length < 3
            ? `Tap around the ${resolvedLabel.toLowerCase()}. ${3 - drawing.length} more point${3 - drawing.length === 1 ? '' : 's'} to go.`
            : 'Tap the first point again, or Close area, to finish.'
          : loading
            ? 'Loading areas…'
            : 'Tap an area to edit it, or Draw area to add one.'}
      </Text>

      {active ? (
        <View style={[styles.editor, { backgroundColor: color.surface, borderColor: color.border }]}>
          <View style={styles.editorTop}>
            <View style={[styles.swatch, { backgroundColor: active.color }]} />
            <Text style={[font.eyebrow, { color: color.textFaint }]}>Selected area</Text>
          </View>
          <TextField
            label="Name"
            value={active.name}
            onChangeText={(name) =>
              updateActive({ name, label: name, physical_zone_label: name })
            }
          />
          <View style={styles.toggleRow}>
            <Text style={[font.body, { color: color.text }]}>Enabled</Text>
            <Switch
              value={active.enabled}
              onValueChange={(enabled) => updateActive({ enabled })}
              trackColor={{ false: color.borderStrong, true: color.accent }}
              thumbColor={color.white}
              ios_backgroundColor={color.borderStrong}
            />
          </View>
          <Button label="Remove area" variant="danger" onPress={() => removeZone(active.id)} />
        </View>
      ) : null}

      <View style={styles.list}>
        <Text style={[font.eyebrow, { color: color.textFaint }]}>
          Areas on this camera · {zones.length}
        </Text>
        {zones.length === 0 ? (
          <Text style={[font.caption, { color: color.textMuted }]}>No areas yet on this camera.</Text>
        ) : (
          zones.map((zone) => (
            <Pressable
              key={zone.id}
              accessibilityRole="button"
              onPress={() => setActiveZoneId(zone.id === activeZoneId ? null : zone.id)}
              style={[
                styles.row,
                {
                  backgroundColor: color.surface,
                  borderColor: zone.id === activeZoneId ? color.accent : color.border,
                },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: zone.color }]} />
              <View style={styles.rowText}>
                <Text style={[font.label, { color: color.text }]}>{zone.name || zone.label}</Text>
                <Text style={[font.caption, { color: color.textMuted }]}>
                  {zone.zone_type.replace(/_/g, ' ')}
                  {zone.enabled ? '' : ' · disabled'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${zone.name || zone.label}`}
                onPress={() => removeZone(zone.id)}
                style={styles.remove}
              >
                <Text style={[font.label, { color: color.danger }]}>Remove</Text>
              </Pressable>
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: space.sm, paddingBottom: space.xs },
  tab: { paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1 },
  drawActions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  editor: { borderWidth: 1, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  editorTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 12, height: 12, borderRadius: radius.pill },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: space.md, marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowText: { flex: 1, gap: 2 },
  remove: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.sm },
});
