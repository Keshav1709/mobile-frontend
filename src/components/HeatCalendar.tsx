import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { useTheme } from '@/state/theme';
import { font, radius, space } from '@/theme';

export type Day = { date: string; people: number };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Fill opacity per heat step; index 0 is "recorded, nobody came". */
const HEAT_ALPHA = [0, 0.22, 0.42, 0.65, 0.9];

type Props = {
  days: Day[];
  /** The month on view. */
  year: number;
  month: number; // 1–12
  todayIso: string;
  selectedIso?: string | null;
  onPrev?: () => void;
  onNext?: () => void;
  /** Tapping a recorded, non-future day. */
  onSelectDay?: (iso: string) => void;
};

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * A month of headcount, one cell per day with the number printed in it — the
 * dashboard's attendance calendar, as the phone draws it.
 *
 * The numbers are the point. A bar chart makes you estimate what a label could just
 * say, so each day carries its count, and the heat tint behind it is only there to
 * let the shape of the month read at arm's length. Intensity is relative to the
 * busiest day on view, so a site with eleven staff and one with two hundred both
 * read.
 *
 * A day with no record at all is left blank; a day recorded at zero is drawn, because
 * "nobody came in" is a fact and an absent row is not. Future days are dimmed and
 * not tappable.
 */
export function HeatCalendar({ days, year, month, todayIso, selectedIso, onPrev, onNext, onSelectDay }: Props) {
  const { color } = useTheme();

  const byDate = new Map(days.map((day) => [day.date, day.people]));
  const daysInMonth = new Date(year, month, 0).getDate();
  // JS getDay() is Sunday-first; shift so Monday is column 0.
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  type Cell = { day: number; iso: string; people: number | null };
  const cells: (Cell | null)[] = Array(lead).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = iso(year, month, day);
    cells.push({ day, iso: key, people: byDate.has(key) ? (byDate.get(key) as number) : null });
  }
  while (cells.length % 7) cells.push(null);

  const recorded = cells.filter((c): c is Cell => c !== null && c.people !== null);
  const peak = Math.max(1, ...recorded.map((c) => c.people as number));
  const step = (people: number | null) =>
    people === null ? -1 : people === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((people / peak) * 4)));

  const weeks: (Cell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthName = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long' });
  const atCurrentMonth = todayIso.slice(0, 7) === iso(year, month, 1).slice(0, 7);

  return (
    <View style={styles.wrap}>
      {onPrev || onNext ? (
        <View style={styles.nav}>
          <Text style={[font.label, { color: color.text }]}>
            {monthName} {year}
          </Text>
          <View style={styles.navButtons}>
            {onPrev ? <IconButton icon="back" label="Previous month" onPress={onPrev} /> : null}
            {onNext && !atCurrentMonth ? (
              <IconButton icon="forward" label="Next month" onPress={onNext} />
            ) : (
              <View style={styles.navSpacer} />
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.row}>
        {WEEKDAYS.map((label, index) => (
          <Text
            key={label}
            style={[
              font.monoSmall,
              styles.cell,
              styles.head,
              // Weekend columns dimmed so the working week reads as the primary block.
              { color: index >= 5 ? color.textFaint : color.textMuted },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, index) => (
        <View key={index} style={styles.row}>
          {week.map((cell, position) => {
            if (!cell) return <View key={`pad-${position}`} style={styles.cell} />;
            const s = step(cell.people);
            const future = cell.iso > todayIso;
            const today = cell.iso === todayIso;
            const selected = cell.iso === selectedIso;
            const saturated = s >= 3;
            const tappable = Boolean(onSelectDay) && !future && cell.people !== null;
            return (
              <View key={cell.iso} style={styles.cell}>
                <Pressable
                  accessibilityRole={tappable ? 'button' : undefined}
                  accessibilityLabel={
                    cell.people === null
                      ? `${cell.day} ${monthName}, no record`
                      : `${cell.day} ${monthName}, ${cell.people} ${cell.people === 1 ? 'person' : 'people'}`
                  }
                  disabled={!tappable}
                  onPress={() => onSelectDay?.(cell.iso)}
                  style={[
                    styles.box,
                    {
                      backgroundColor:
                        s === -1 ? 'transparent' : s === 0 ? color.surfaceSunken : color.accentBright,
                      opacity: future ? 0.4 : s <= 0 ? 1 : HEAT_ALPHA[s],
                      borderWidth: s === -1 || today || selected ? 1 : 0,
                      borderColor: today || selected ? color.accent : color.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      font.monoSmall,
                      styles.dayNumber,
                      { color: saturated ? color.white : color.textFaint },
                    ]}
                  >
                    {cell.day}
                  </Text>
                  {cell.people === null ? null : (
                    <Text
                      style={[font.mono, styles.count, { color: saturated ? color.white : color.text }]}
                    >
                      {cell.people}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.foot}>
        <Text style={[font.caption, { color: color.textMuted }]}>
          <Text style={[font.mono, { color: color.text }]}>{recorded.length}</Text> days recorded
        </Text>
        <View style={styles.legend}>
          <Text style={[font.monoSmall, { color: color.textFaint }]}>FEWER</Text>
          {HEAT_ALPHA.map((alpha, i) => (
            <View
              key={alpha}
              style={[
                styles.swatch,
                i === 0
                  ? { backgroundColor: color.surfaceSunken, borderWidth: 1, borderColor: color.border }
                  : { backgroundColor: color.accentBright, opacity: alpha },
              ]}
            />
          ))}
          <Text style={[font.monoSmall, { color: color.textFaint }]}>MORE</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.xs },
  navButtons: { flexDirection: 'row', gap: space.xs },
  navSpacer: { width: 40 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  head: { marginBottom: 2, textAlign: 'center' },
  box: {
    width: '92%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: { position: 'absolute', top: 3, left: 4, fontSize: 9 },
  count: { fontSize: 14, paddingTop: 4 },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingTop: space.sm,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});
