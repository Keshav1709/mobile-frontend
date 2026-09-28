import { ReactElement, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { Point, ZonePolygon, pointInPolygon, polygonCentroid } from '@/lib/zones';
import { useTheme } from '@/state/theme';
import { family, font, radius } from '@/theme';

/** Tapping this close (in points) to the first vertex closes the outline. */
const CLOSE_RADIUS = 18;

export type ZoneCanvasMode = 'draw' | 'idle';

type Props = {
  /**
   * The frame to outline on, as an image source rather than a URL: the relay it
   * comes from requires credentials, and those travel in the source's `headers`.
   */
  image: { uri: string; headers?: Record<string, string> } | null;
  zones: ZonePolygon[];
  activeZoneId: string | null;
  mode: ZoneCanvasMode;
  /** Vertices of the outline in progress, normalised. Owned by the screen. */
  drawing: Point[];
  onDrawingChange: (points: Point[]) => void;
  /** The outline is complete: three or more points, closed by the user. */
  onClose: (points: Point[]) => void;
  onActiveZoneChange: (id: string | null) => void;
};

/**
 * The camera view with areas drawn over it. A port of the dashboard's
 * ZoneCanvas for touch: in draw mode every tap adds a vertex and a tap back
 * on the first one closes the shape; otherwise a tap inside an area selects it.
 * Coordinates are normalised so the same polygon fits any screen or stream size.
 */
export function ZoneCanvas({
  image,
  zones,
  activeZoneId,
  mode,
  drawing,
  onDrawingChange,
  onClose,
  onActiveZoneChange,
}: Props) {
  const { color } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageFailed, setImageFailed] = useState(false);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const toPixels = ([x, y]: Point): Point => [x * size.width, y * size.height];
  const polygonPoints = (points: Point[]) =>
    points.map((point) => toPixels(point).join(',')).join(' ');

  const tap = (px: number, py: number) => {
    if (!size.width || !size.height) return;
    const point: Point = [
      Math.max(0, Math.min(1, px / size.width)),
      Math.max(0, Math.min(1, py / size.height)),
    ];

    if (mode !== 'draw') {
      const hit = [...zones].reverse().find((zone) => pointInPolygon(point, zone.points));
      onActiveZoneChange(hit?.id ?? null);
      return;
    }

    if (drawing.length >= 3) {
      const [fx, fy] = toPixels(drawing[0]);
      if (Math.hypot(px - fx, py - fy) <= CLOSE_RADIUS) {
        onClose(drawing);
        return;
      }
    }
    onDrawingChange([...drawing, point]);
  };

  return (
    <View
      style={[styles.frame, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}
    >
      <View style={styles.aspect} onLayout={onLayout}>
        {image && !imageFailed ? (
          <Image
            source={image}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <Text style={[font.caption, { color: color.textFaint }]}>
              {image ? 'Snapshot unavailable' : 'No live frame yet. Outline on the grid.'}
            </Text>
          </View>
        )}

        {size.width > 0 ? (
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
            {!image || imageFailed ? <Grid width={size.width} height={size.height} /> : null}

            {zones.map((zone) => {
              if (zone.points.length < 3) return null;
              const active = zone.id === activeZoneId;
              const [cx, cy] = toPixels(polygonCentroid(zone.points));
              const label = zone.name || zone.label;
              const labelWidth = label.length * 7 + 16;
              return (
                <G key={zone.id}>
                  <Polygon
                    points={polygonPoints(zone.points)}
                    fill={zone.color}
                    fillOpacity={active ? 0.35 : zone.enabled ? 0.2 : 0.08}
                    stroke={zone.color}
                    strokeWidth={active ? 3 : 2}
                    strokeDasharray={zone.enabled ? undefined : '6,4'}
                  />
                  <Rect
                    x={cx - labelWidth / 2}
                    y={cy - 12}
                    width={labelWidth}
                    height={24}
                    rx={6}
                    fill="rgba(15, 23, 42, 0.82)"
                  />
                  <SvgText
                    x={cx}
                    y={cy + 4}
                    fill="#ffffff"
                    fontSize={12}
                    fontFamily={family.semibold}
                    textAnchor="middle"
                  >
                    {label}
                  </SvgText>
                </G>
              );
            })}

            {drawing.length > 0 ? (
              <G>
                <Polyline
                  points={polygonPoints(drawing)}
                  fill="none"
                  stroke={color.accent}
                  strokeWidth={2}
                />
                {drawing.length >= 3 ? (
                  <Polyline
                    points={polygonPoints([drawing[drawing.length - 1], drawing[0]])}
                    fill="none"
                    stroke={color.accent}
                    strokeWidth={2}
                    strokeDasharray="8,6"
                  />
                ) : null}
                {drawing.map((point, index) => {
                  const [x, y] = toPixels(point);
                  const first = index === 0 && drawing.length >= 3;
                  return (
                    <Circle
                      key={index}
                      cx={x}
                      cy={y}
                      r={first ? 9 : 5}
                      fill={first ? color.accent : '#ffffff'}
                      stroke={color.accent}
                      strokeWidth={2}
                    />
                  );
                })}
              </G>
            ) : null}
          </Svg>
        ) : null}

        <Pressable
          accessibilityRole="image"
          accessibilityLabel={
            mode === 'draw' ? 'Tap to add points around the area' : 'Tap an area to select it'
          }
          style={StyleSheet.absoluteFill}
          onPress={(event) => tap(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        />
      </View>
    </View>
  );
}

/** A faint grid so an outline has something to sit on when no frame exists. */
function Grid({ width, height }: { width: number; height: number }) {
  const { color } = useTheme();
  const step = width / 8;
  const lines: ReactElement[] = [];
  for (let x = step; x < width; x += step) {
    lines.push(
      <Polyline key={`v${x}`} points={`${x},0 ${x},${height}`} stroke={color.border} strokeWidth={1} />,
    );
  }
  for (let y = step; y < height; y += step) {
    lines.push(
      <Polyline key={`h${y}`} points={`0,${y} ${width},${y}`} stroke={color.border} strokeWidth={1} />,
    );
  }
  return <>{lines}</>;
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  aspect: { width: '100%', aspectRatio: 16 / 9 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
