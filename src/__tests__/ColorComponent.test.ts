import * as THREE from 'three';
import { ColorComponent } from '../ParticleSystem/components/ColorComponent';
import { ColorCurve, ColorRange } from '../ParticleSystem/Range';
import { ParticleComponent } from '../ParticleSystem/components/ParticleComponent';

type ColorValue = THREE.Color | ColorRange | ColorCurve | undefined;

/**
 * Mock ParticleSystem for testing
 * Provides minimal implementation required for ColorComponent testing
 */
class MockParticleSystem {
  config = {
    maxParticles: 10,
    particle: {
      color: undefined as ColorValue
    }
  };

  geometry = new THREE.BufferGeometry();
  material = new THREE.RawShaderMaterial();
  colors = new Float32Array(this.config.maxParticles * 3);
  components: ParticleComponent[] = [];
}

/**
 * Tests for ColorComponent
 *
 * Tests cover:
 * - Initialization with different color types (static, range, curve)
 * - Initial color setting on particle emission
 * - Color updates during particle lifetime
 * - Color buffer operations during particle data compaction
 * - Rendering system interaction via attributes/uniforms
 */
describe('ColorComponent', () => {
  let particleSystem: MockParticleSystem;

  beforeEach(() => {
    particleSystem = new MockParticleSystem();
  });

  describe('initialization', () => {
    it('should initialize with static color', () => {
      const color = new THREE.Color(1, 0, 0);
      particleSystem.config.particle.color = color;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();

      expect(component['needsColorUpdate']).toBe(false);
      expect(component['colors']).toBeInstanceOf(Float32Array);
      expect(component['colors'].length).toBe(particleSystem.config.maxParticles * 3);
    });

    it('should initialize with color range', () => {
      const colorRange = new ColorRange(new THREE.Color(1, 0, 0), new THREE.Color(0, 1, 0));
      particleSystem.config.particle.color = colorRange;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();

      expect(component['needsColorUpdate']).toBe(true);
      expect(component['colors']).toBeInstanceOf(Float32Array);
    });

    it('should initialize with color curve', () => {
      const colorCurve = new ColorCurve([
        [0, new THREE.Color(1, 0, 0)],
        [1, new THREE.Color(0, 1, 0)],
      ]);
      particleSystem.config.particle.color = colorCurve;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();

      expect(component['needsColorUpdate']).toBe(true);
      expect(component['colors']).toBeInstanceOf(Float32Array);
    });
  });

  describe('onEmit', () => {
    it('should set static color', () => {
      const color = new THREE.Color(1, 0, 0);
      particleSystem.config.particle.color = color;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();
      component.onEmit(0);

      expect(component['colors'][0]).toBe(1);
      expect(component['colors'][1]).toBe(0);
      expect(component['colors'][2]).toBe(0);
    });

    it('should set initial color from range', () => {
      const colorRange = new ColorRange(new THREE.Color(1, 0, 0), new THREE.Color(0, 1, 0));
      particleSystem.config.particle.color = colorRange;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();
      component.onEmit(0);

      expect(component['colors'][0]).toBe(1);
      expect(component['colors'][1]).toBe(0);
      expect(component['colors'][2]).toBe(0);
    });
  });

  describe('onUpdate', () => {
    it('should update color over lifetime for color range', () => {
      const colorRange = new ColorRange(new THREE.Color(1, 0, 0), new THREE.Color(0, 1, 0));
      particleSystem.config.particle.color = colorRange;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();
      component.onEmit(0);
      component.onUpdate(0, 0.016, 0.5);

      expect(component['colors'][0]).toBeCloseTo(0.5);
      expect(component['colors'][1]).toBeCloseTo(0.5);
      expect(component['colors'][2]).toBe(0);
    });

    it('should not update color for static color', () => {
      const color = new THREE.Color(1, 0, 0);
      particleSystem.config.particle.color = color;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();
      component.onEmit(0);

      const originalRed = component['colors'][0];
      component.onUpdate(0, 0.016, 0.5);

      expect(component['colors'][0]).toBe(originalRed);
    });

    it('should interpolate color along curve', () => {
      const colorCurve = new ColorCurve([
        [0, new THREE.Color(1, 0, 0)],    // красный
        [0.5, new THREE.Color(0, 1, 0)],   // зеленый
        [1, new THREE.Color(0, 0, 1)]      // синий
      ]);
      particleSystem.config.particle.color = colorCurve;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();
      component.onEmit(0);

      // Проверяем начальный цвет (красный)
      expect(component['colors'][0]).toBe(1);
      expect(component['colors'][1]).toBe(0);
      expect(component['colors'][2]).toBe(0);

      // Проверяем середину (зеленый)
      component.onUpdate(0, 0.016, 0.5);
      expect(component['colors'][0]).toBeCloseTo(0);
      expect(component['colors'][1]).toBeCloseTo(1);
      expect(component['colors'][2]).toBeCloseTo(0);

      // Проверяем конец (синий)
      component.onUpdate(0, 0.016, 1);
      expect(component['colors'][0]).toBeCloseTo(0);
      expect(component['colors'][1]).toBeCloseTo(0);
      expect(component['colors'][2]).toBeCloseTo(1);
    });
  });

  describe('compactParticleData', () => {
    it('should correctly copy color data', () => {
      const color = new THREE.Color(1, 0, 0);
      particleSystem.config.particle.color = color;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();
      component.onEmit(1);
      component.compactParticleData(0, 1);

      expect(component['colors'][0]).toBe(component['colors'][3]);
      expect(component['colors'][1]).toBe(component['colors'][4]);
      expect(component['colors'][2]).toBe(component['colors'][5]);
    });

    it('should handle edge cases in compactParticleData', () => {
      const color = new THREE.Color(1, 0, 0);
      particleSystem.config.particle.color = color;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();

      // Тест с максимальным допустимым индексом
      const maxIndex = particleSystem.config.maxParticles - 1;
      component.onEmit(maxIndex);
      component.compactParticleData(0, maxIndex);

      expect(component['colors'][0]).toBe(component['colors'][maxIndex * 3]);
      expect(component['colors'][1]).toBe(component['colors'][maxIndex * 3 + 1]);
      expect(component['colors'][2]).toBe(component['colors'][maxIndex * 3 + 2]);

      // Тест с одинаковыми индексами
      component.onEmit(1);
      const originalColor = [
        component['colors'][3],
        component['colors'][4],
        component['colors'][5]
      ];
      component.compactParticleData(1, 1);

      expect(component['colors'][3]).toBe(originalColor[0]);
      expect(component['colors'][4]).toBe(originalColor[1]);
      expect(component['colors'][5]).toBe(originalColor[2]);
    });
  });

  describe('markAttributesNeedUpdate', () => {
    it('should update attribute when needed', () => {
      const color = new THREE.Color(1, 0, 0);
      particleSystem.config.particle.color = color;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();

      const mockAttribute = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
      Object.defineProperty(mockAttribute, 'needsUpdate', {
        get() { return this._needsUpdate; },
        set(value) { this._needsUpdate = value; }
      });
      component['colorAttribute'] = mockAttribute;

      component.onEmit(0);
      expect(component['needsUpdate']).toBe(true);

      component.markAttributesNeedUpdate();
      expect(mockAttribute.needsUpdate).toBe(true);
      expect(component['needsUpdate']).toBe(false);
    });
  });

  describe('getAttributes', () => {
    it('should return correct attribute with proper name', () => {
      const color = new THREE.Color(1, 0, 0);
      particleSystem.config.particle.color = color;
      const component = new ColorComponent(particleSystem as any);
      component.initialize();

      const attrs = component.getAttributes();
      expect(attrs.instanceColor).toBeDefined();
      expect(attrs.instanceColor).toBe(component['colorAttribute']);
    });
  });

  describe('getUniforms and getDefines', () => {
    it('should return empty objects', () => {
      const color = new THREE.Color(1, 0, 0);
      particleSystem.config.particle.color = color;
      const component = new ColorComponent(particleSystem as any);

      expect(component.getUniforms()).toEqual({});
      expect(component.getDefines()).toEqual({});
    });
  });
});