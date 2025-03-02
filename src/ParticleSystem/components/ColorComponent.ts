import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem, { ParticleSystemConfig } from '../ParticleSystem';
import { ColorCurve, ColorRange } from '../Range';

type ColorValue = THREE.Color | ColorRange | ColorCurve;

export class ColorComponent extends ParticleComponent {
  private colors!: Float32Array;
  private colorAttribute!: THREE.InstancedBufferAttribute;
  private needsColorUpdate: boolean;
  private needsUpdate: boolean = false;
  private color: ColorValue;

  static getConfigValue(config: ParticleSystemConfig): THREE.Color | ColorRange | ColorCurve | undefined {
    return config.particle.color;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const color = ColorComponent.getConfigValue(system.config);
    if (!color) throw new Error('Color value is required for ColorComponent');
    this.color = color;
    this.needsColorUpdate = color instanceof ColorCurve || color instanceof ColorRange;
  }

  initialize(): void {
    this.colors = new Float32Array(this.system.config.maxParticles * 3);
    this.colorAttribute = new THREE.InstancedBufferAttribute(this.colors, 3);
  }

  onEmit(index: number): void {
    if (this.color instanceof THREE.Color) {
      this.colors[index * 3] = this.color.r;
      this.colors[index * 3 + 1] = this.color.g;
      this.colors[index * 3 + 2] = this.color.b;
    } else {
      const color = this.color.lerp(0);
      this.colors[index * 3] = color.r;
      this.colors[index * 3 + 1] = color.g;
      this.colors[index * 3 + 2] = color.b;
    }
    this.needsUpdate = true;
  }

  onUpdate(index: number, _deltaTime: number, lifePercent: number): void {
    if (this.needsColorUpdate) {
      const color = (this.color as ColorCurve | ColorRange).lerp(lifePercent);
      this.colors[index * 3] = color.r;
      this.colors[index * 3 + 1] = color.g;
      this.colors[index * 3 + 2] = color.b;
      this.needsUpdate = true;
    }
  }

  compactParticleData(targetIndex: number, sourceIndex: number): void {
    this.colors[targetIndex * 3] = this.colors[sourceIndex * 3];
    this.colors[targetIndex * 3 + 1] = this.colors[sourceIndex * 3 + 1];
    this.colors[targetIndex * 3 + 2] = this.colors[sourceIndex * 3 + 2];
    this.needsUpdate = true;
  }

  markAttributesNeedUpdate(): void {
    if (this.needsUpdate) {
      this.colorAttribute.needsUpdate = true;
      this.needsUpdate = false;
    }
  }

  getAttributes(): Record<string, THREE.BufferAttribute> {
    return {
      instanceColor: this.colorAttribute
    };
  }

  getUniforms(): Record<string, { value: any }> {
    return {};
  }

  getDefines(): Record<string, boolean> {
    return {};
  }
}