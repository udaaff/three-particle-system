import * as THREE from 'three';
import { Range, ColorRange, SpeedRange, Curve, ColorCurve, range, curve } from '../ParticleSystem/Range';

describe('Range', () => {
  it('should interpolate numbers correctly', () => {
    const r = new Range(0, 10);
    expect(r.lerp(0)).toBe(0);
    expect(r.lerp(0.5)).toBe(5);
    expect(r.lerp(1)).toBe(10);
  });

  it('should work with negative numbers', () => {
    const r = new Range(-10, 10);
    expect(r.lerp(0)).toBe(-10);
    expect(r.lerp(0.5)).toBe(0);
    expect(r.lerp(1)).toBe(10);
  });
});

describe('ColorRange', () => {
  it('should interpolate colors correctly', () => {
    const r = new ColorRange(
      new THREE.Color(1, 0, 0),  // Красный
      new THREE.Color(0, 0, 1)   // Синий
    );

    const midColor = r.lerp(0.5);
    expect(midColor.r).toBeCloseTo(0.5);
    expect(midColor.g).toBeCloseTo(0);
    expect(midColor.b).toBeCloseTo(0.5);
  });
});

describe('SpeedRange', () => {
  it('should interpolate vectors correctly', () => {
    const r = new SpeedRange(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 2, 3)
    );

    const midVector = r.lerp(0.5);
    expect(midVector.x).toBeCloseTo(0.5);
    expect(midVector.y).toBeCloseTo(1);
    expect(midVector.z).toBeCloseTo(1.5);
  });
});

describe('Curve', () => {
  it('should interpolate between points correctly', () => {
    const c = new Curve([
      [0, 0],
      [0.5, 1],
      [1, 0]
    ]);

    expect(c.lerp(0)).toBe(0);    // Начальная точка
    expect(c.lerp(0.25)).toBe(0.5);  // Середина между 0 и 1
    expect(c.lerp(0.5)).toBe(1);   // Пиковая точка
    expect(c.lerp(0.75)).toBe(0.5);  // Середина между 1 и 0
    expect(c.lerp(1)).toBe(0);    // Конечная точка
  });

  it('should handle unsorted points', () => {
    const c = new Curve([
      [1, 0],
      [0, 0],
      [0.5, 1]
    ]);

    expect(c.lerp(0)).toBe(0);
    expect(c.lerp(0.5)).toBe(1);
    expect(c.lerp(1)).toBe(0);
  });

  it('should clamp values outside range', () => {
    const c = new Curve([
      [0, 0],
      [1, 1]
    ]);

    expect(c.lerp(-1)).toBe(0);   // Меньше минимума
    expect(c.lerp(2)).toBe(1);    // Больше максимума
  });

  it('should handle single point', () => {
    const c = new Curve([[0, 42]]);
    expect(c.lerp(0)).toBe(42);
    expect(c.lerp(0.5)).toBe(42);
    expect(c.lerp(1)).toBe(42);
  });

  it('should handle multiple segments with different slopes', () => {
    const c = new Curve([
      [0, 0],    // Начало
      [0.3, 3],  // Крутой подъем
      [0.7, 4],  // Пологий подъем
      [1, 0]     // Спуск
    ]);

    // Проверяем точки на разных сегментах
    expect(c.lerp(0.15)).toBe(1.5);  // Середина первого сегмента
    expect(c.lerp(0.5)).toBe(3.5);   // Середина второго сегмента
    expect(c.lerp(0.85)).toBe(2);    // Середина третьего сегмента
  });

  it('should handle zero-length segments', () => {
    const c = new Curve([
      [0, 0],
      [0.5, 1],
      [0.5, 2], // Та же X-координата
      [1, 3]
    ]);

    expect(c.lerp(0.5)).toBe(2); // Должен использовать последнее значение в точке
  });
});

describe('ColorCurve', () => {
  it('should interpolate colors correctly', () => {
    const c = new ColorCurve([
      [0, new THREE.Color(1, 0, 0)],    // Красный
      [0.5, new THREE.Color(0, 1, 0)],  // Зеленый
      [1, new THREE.Color(0, 0, 1)]     // Синий
    ]);

    const midColor = c.lerp(0.25);
    expect(midColor.r).toBeCloseTo(0.5);
    expect(midColor.g).toBeCloseTo(0.5);
    expect(midColor.b).toBeCloseTo(0);
  });

  it('should handle color values outside range', () => {
    const c = new ColorCurve([
      [0, new THREE.Color(1, 0, 0)],
      [1, new THREE.Color(0, 0, 1)]
    ]);

    const belowColor = c.lerp(-0.5);
    expect(belowColor.r).toBeCloseTo(1);
    expect(belowColor.g).toBeCloseTo(0);
    expect(belowColor.b).toBeCloseTo(0);

    const aboveColor = c.lerp(1.5);
    expect(aboveColor.r).toBeCloseTo(0);
    expect(aboveColor.g).toBeCloseTo(0);
    expect(aboveColor.b).toBeCloseTo(1);
  });
});

describe('helper functions', () => {
  it('range should create correct type for numbers', () => {
    const r = range(0, 10);
    expect(r).toBeInstanceOf(Range);
    expect(r.lerp(0.5)).toBe(5);
  });

  it('range should create correct type for colors', () => {
    const r = range(new THREE.Color(1, 0, 0), new THREE.Color(0, 0, 1));
    expect(r).toBeInstanceOf(ColorRange);
  });

  it('range should create correct type for vectors', () => {
    const r = range(new THREE.Vector3(), new THREE.Vector3(1, 1, 1));
    expect(r).toBeInstanceOf(SpeedRange);
  });

  it('curve should create correct type for numbers', () => {
    const c = curve([
      [0, 0],
      [1, 1]
    ]);
    expect(c).toBeInstanceOf(Curve);
    expect(c.lerp(0.5)).toBe(0.5);
  });

  it('curve should create correct type for colors', () => {
    const c = curve([
      [0, new THREE.Color(1, 0, 0)],
      [1, new THREE.Color(0, 0, 1)]
    ]);
    expect(c).toBeInstanceOf(ColorCurve);
  });

  it('should throw error for invalid range input', () => {
    expect(() => range('invalid' as any, 'invalid' as any)).toThrow('Invalid range');
  });
});