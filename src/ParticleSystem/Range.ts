import * as THREE from 'three';

const color = new THREE.Color();

export interface IRange<T> {
  lerp(t: number): T;
}

export class Range implements IRange<number> {
  constructor(
    public from: number,
    public to: number
  ) {}

  lerp(t: number) {
    return (this.to - this.from) * t + this.from;
  }
}

export class ColorRange implements IRange<THREE.Color> {
  constructor(
    public from: THREE.Color,
    public to: THREE.Color
  ) {}

  lerp(t: number) {
    return color.lerpColors(this.from, this.to, t);
  }
}

export class SpeedRange implements IRange<THREE.Vector3> {
  constructor(
    public from: THREE.Vector3,
    public to: THREE.Vector3
  ) {}

  lerp(t: number) {
    return this.from.lerp(this.to, t);
  }
}

export class ColorCurve implements IRange<THREE.Color> {
  private points: Array<[number, THREE.Color]>;

  constructor(points: Array<[number, THREE.Color]>) {
    this.points = points.sort((a, b) => a[0] - b[0]);
  }

  lerp(t: number): THREE.Color {
    if (t <= this.points[0][0]) return this.points[0][1].clone();
    if (t >= this.points[this.points.length - 1][0]) return this.points[this.points.length - 1][1].clone();

    let i = 1;
    while (i < this.points.length && t > this.points[i][0]) i++;

    const x0 = this.points[i - 1][0];
    const x1 = this.points[i][0];
    const c0 = this.points[i - 1][1];
    const c1 = this.points[i][1];

    const t_normalized = (t - x0) / (x1 - x0);
    return color.lerpColors(c0, c1, t_normalized);
  }
}

export class Curve implements IRange<number> {
  private points: Array<[number, number]>;

  constructor(points: Array<[number, number]>) {
    this.points = points.sort((a, b) => a[0] - b[0]);
  }

  lerp(t: number): number {
    if (t <= this.points[0][0]) return this.points[0][1];
    if (t >= this.points[this.points.length - 1][0]) return this.points[this.points.length - 1][1];

    let i = 1;
    while (i < this.points.length && t >= this.points[i][0]) i++;
    i--;

    if (i + 1 < this.points.length && this.points[i][0] === this.points[i + 1][0]) {
      return this.points[i + 1][1];
    }

    const x0 = this.points[i][0];
    const x1 = this.points[i + 1][0];
    const y0 = this.points[i][1];
    const y1 = this.points[i + 1][1];

    const t_normalized = (t - x0) / (x1 - x0);
    return y0 + (y1 - y0) * t_normalized;
  }
}

type RangeType<T> = T extends number ? Range
  : T extends THREE.Color ? ColorRange
  : SpeedRange;
type RangeInput = number | THREE.Color | THREE.Vector3;

export function range<T extends RangeInput>(from: T, to: T): RangeType<T> {
  if (typeof from === 'number' && typeof to === 'number') {
    return new Range(from, to) as RangeType<T>;
  }
  if (from instanceof THREE.Color && to instanceof THREE.Color) {
    return new ColorRange(from, to) as RangeType<T>;
  }
  if (from instanceof THREE.Vector3 && to instanceof THREE.Vector3) {
    return new SpeedRange(from, to) as RangeType<T>;
  }
  throw new Error('Invalid range');
}

type CurveType<T> = T extends number ? Curve : ColorCurve;
type CurveInput = number | THREE.Color;

export function curve<T extends CurveInput>(points: Array<[number, T]>): CurveType<T> {
  if (points[0][1] instanceof THREE.Color) {
    return new ColorCurve(points as Array<[number, THREE.Color]>) as CurveType<T>;
  }
  return new Curve(points as Array<[number, number]>) as CurveType<T>;
}
