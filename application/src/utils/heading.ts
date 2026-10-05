export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function shortestAngleDelta(from: number, to: number): number {
  const delta = normalizeAngle(to - from);
  return delta > 180 ? delta - 360 : delta;
}

export function smoothHeading(
  previous: number,
  next: number,
  alpha: number,
): number {
  const weight = Math.min(1, Math.max(0, alpha));
  return normalizeAngle(previous + shortestAngleDelta(previous, next) * weight);
}
