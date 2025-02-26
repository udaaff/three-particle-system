import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem from '../ParticleSystem';
import { ColorCurve, ColorRange } from '../Range';

export class ColorComponent extends ParticleComponent {
  private colors!: Float32Array;
  private colorAttribute!: THREE.InstancedBufferAttribute;
  private needsColorUpdate: boolean;
  private needsUpdate: boolean = false;

  constructor(
    system: ParticleSystem,
    private color: THREE.Color | ColorRange | ColorCurve
  ) {
    super(system);
    this.needsColorUpdate = color instanceof ColorCurve || color instanceof ColorRange;
  }

  initialize(): void {
    this.colors = new Float32Array(this.system.config.maxParticles * 3);
    this.colorAttribute = new THREE.InstancedBufferAttribute(this.colors, 3);
  }

  onEmit(index: number): void {
    if (!this.color) {
      // Используем цвет текстуры
      this.colors[index * 3] = -1;
      this.colors[index * 3 + 1] = -1;
      this.colors[index * 3 + 2] = -1;
    } else if (this.color instanceof THREE.Color) {
      // Один цвет
      this.colors[index * 3] = this.color.r;
      this.colors[index * 3 + 1] = this.color.g;
      this.colors[index * 3 + 2] = this.color.b;
    } else if (this.color instanceof ColorCurve) {
      // Кривая цвета
      const color = this.color.lerp(0);
      this.colors[index * 3] = color.r;
      this.colors[index * 3 + 1] = color.g;
      this.colors[index * 3 + 2] = color.b;
    } else {
      // Range цвета
      const { from } = this.color;
      this.colors[index * 3] = from.r;
      this.colors[index * 3 + 1] = from.g;
      this.colors[index * 3 + 2] = from.b;
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