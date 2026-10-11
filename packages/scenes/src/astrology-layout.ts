/** Display-only displacement; leader lines retain the original longitude. */
export function layoutMarkers(
  bodies: { id: string; longitude: number }[],
  gap = 20,
) {
  if (!bodies.length) return [];
  const sorted = [...bodies].sort(
    (a, b) => a.longitude - b.longitude || a.id.localeCompare(b.id),
  );
  let cut = 0,
    largest = -1;
  for (let i = 0; i < sorted.length; i++) {
    const next = (i + 1) % sorted.length;
    const distance = (sorted[next].longitude - sorted[i].longitude + 360) % 360;
    if (distance > largest) {
      largest = distance;
      cut = next;
    }
  }
  const ordered = [...sorted.slice(cut), ...sorted.slice(0, cut)];
  const original = ordered.map(
    (b, i) => b.longitude + (i && b.longitude < ordered[0].longitude ? 360 : 0),
  );
  const display = [...original],
    spacing = Math.min(gap, 360 / ordered.length);
  for (let i = 1; i < display.length; i++)
    display[i] = Math.max(display[i], display[i - 1] + spacing);
  display[0] = Math.max(display[0], display.at(-1)! - (360 - spacing));
  for (let i = 1; i < display.length; i++)
    display[i] = Math.max(display[i], display[i - 1] + spacing);
  const drift =
    display.reduce((sum, a, i) => sum + a - original[i], 0) / display.length;
  return ordered.map((b, i) => ({
    ...b,
    displayLongitude: (((display[i] - drift) % 360) + 360) % 360,
  }));
}
