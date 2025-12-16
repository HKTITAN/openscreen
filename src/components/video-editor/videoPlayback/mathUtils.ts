export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

/** Standard smoothstep - good for general transitions */
export function smoothStep(t: number) {
  const clamped = clamp01(t);
  return clamped * clamped * (3 - 2 * clamped);
}

/** Smoother step (Ken Perlin's improved version) - better for cursor following */
export function smootherStep(t: number) {
  const clamped = clamp01(t);
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

/** Attempt Catmull-Rom spline interpolation for 4 points */
export function catmullRomInterpolate(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
  tension: number = 0.5
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  
  const m1 = tension * (p2 - p0);
  const m2 = tension * (p3 - p1);
  
  return (2 * t3 - 3 * t2 + 1) * p1 +
         (t3 - 2 * t2 + t) * m1 +
         (-2 * t3 + 3 * t2) * p2 +
         (t3 - t2) * m2;
}
