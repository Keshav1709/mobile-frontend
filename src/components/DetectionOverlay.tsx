import { StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import type { WsDetection } from '@/state/live';
import { useTheme } from '@/state/theme';

/**
 * The boxes the edge is seeing right now, drawn over the camera picture.
 *
 * This is what makes Live feel live. The JPEG underneath only refreshes every
 * couple of seconds, which on its own looks like a slideshow; the detections
 * arrive on the websocket many times a second, so the boxes move continuously
 * over a still frame and the tile reads as a live camera rather than a photo.
 * The web console does exactly this, and the rules below are ported from its
 * `mapDetections.ts` so the two never disagree about what is drawn.
 */

/**
 * COCO classes the overlay never draws. The edge's general detector reports all
 * 80; on a site wall only people, vehicles and safety labels mean anything, and
 * a box around every chair and bottle buries them. Face streams label boxes with
 * a person's name, which is never in this set, so names always show.
 */
const HIDDEN_CLASSES = new Set([
  'airplane', 'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe',
  'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard',
  'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana',
  'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
  'chair', 'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush', 'train',
]);

type Box = { id: string; label: string; x: number; y: number; w: number; h: number };

/**
 * Normalised boxes, or an empty list.
 *
 * `bbox` arrives either already normalised or in frame pixels, and the only way
 * to tell is magnitude: nothing normalised exceeds 1. When it is pixels the
 * frame size has to be known, and until the socket has sent one there is
 * nothing sensible to draw.
 */
export function toBoxes(
  detections: WsDetection[],
  frame: { w: number; h: number } | undefined,
): Box[] {
  const out: Box[] = [];
  detections.forEach((d, i) => {
    if (!Array.isArray(d.bbox) || d.bbox.length !== 4) return;
    if (HIDDEN_CLASSES.has((d.class_name || '').trim().toLowerCase())) return;

    let [x1, y1, x2, y2] = d.bbox.map(Number) as [number, number, number, number];
    if (![x1, y1, x2, y2].every(Number.isFinite)) return;

    if (x2 > 1.5 || y2 > 1.5) {
      if (!frame?.w || !frame?.h) return;
      x1 /= frame.w;
      x2 /= frame.w;
      y1 /= frame.h;
      y2 /= frame.h;
    }

    const who = d.name ?? d.person ?? null;
    out.push({
      id: d.track_id != null ? `t${d.track_id}` : `d${i}`,
      label: who || d.class_name || 'object',
      x: x1,
      y: y1,
      w: Math.max(0, x2 - x1),
      h: Math.max(0, y2 - y1),
    });
  });
  return out;
}

export function DetectionOverlay({
  detections,
  frame,
}: {
  detections: WsDetection[];
  frame: { w: number; h: number } | undefined;
}) {
  const { color } = useTheme();
  const boxes = toBoxes(detections, frame);
  if (!boxes.length) return null;

  // A 0-1 viewBox means the boxes scale with the tile without measuring it.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        {boxes.map((b) => (
          <Rect
            key={b.id}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            fill="none"
            stroke={color.accentBright}
            strokeWidth={0.004}
          />
        ))}
      </Svg>
      {/* Labels sit in their own non-scaling layer: stretching a 0-1 viewBox to
          a 16:9 tile would stretch the type with it. */}
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {boxes.map((b) => (
          <SvgText
            key={b.id}
            x={b.x * 100}
            y={Math.max(3, b.y * 100 - 1.2)}
            fill={color.accentBright}
            fontSize={3.4}
            fontWeight="600"
          >
            {b.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
