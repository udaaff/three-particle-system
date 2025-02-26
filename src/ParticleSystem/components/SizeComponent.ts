import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem, { ParticleSystemConfig } from '../ParticleSystem';
import { Curve, Range } from '../Range';

type SizeValue = number | Range | Curve;

export class SizeComponent extends ParticleComponent {
  private sizes!: Float32Array;
  private instanceScale!: THREE.InstancedBufferAttribute;
  private needsSizeUpdate: boolean;
  private needsUpdate: boolean = false;
  private size: SizeValue;

  static override getConfigValue(config: ParticleSystemConfig): SizeValue | undefined {
    return config.particle.size;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const size = SizeComponent.getConfigValue(system.config);
    if (!size) throw new Error('Size value is required for SizeComponent');
    this.size = size;
    this.needsSizeUpdate = size instanceof Curve || size instanceof Range;
  }

  initialize(): void {
    this.sizes = new Float32Array(this.system.config.maxParticles);
    this.instanceScale = new THREE.InstancedBufferAttribute(this.sizes, 1);
  }

  getDefines(): Record<string, boolean> {
    return {
      USE_SIZE: true
    };
  }

  getUniforms(): Record<string, THREE.IUniform> {
    return {};
  }

  getAttributes(): Record<string, THREE.BufferAttribute> {
    return {
      instanceScale: this.instanceScale
    };
  }

  markAttributesNeedUpdate(): void {
    if (this.needsUpdate) {
      this.instanceScale.needsUpdate = true;
      this.needsUpdate = false;
    }
  }

  onEmit(index: number): void {
    if (typeof this.size === 'number') {
      this.sizes[index] = this.size;
    } else {
      this.sizes[index] = this.size.lerp(0);
    }
    this.needsUpdate = true;
  }

  onUpdate(index: number, _deltaTime: number, lifePercent: number): void {
    if (this.needsSizeUpdate) {
      this.sizes[index] = (this.size as Range | Curve).lerp(lifePercent);
      this.needsUpdate = true;
    }
  }

  compactParticleData(targetIndex: number, sourceIndex: number): void {
    this.sizes[targetIndex] = this.sizes[sourceIndex];
    this.needsUpdate = true;
  }
}