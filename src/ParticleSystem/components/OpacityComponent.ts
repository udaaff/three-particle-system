import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem from '../ParticleSystem';
import { Range, Curve } from '../Range';

type OpacityValue = number | Range | Curve;

export class OpacityComponent extends ParticleComponent {
  private opacities!: Float32Array;
  private opacityAttribute!: THREE.InstancedBufferAttribute;
  private needsOpacityUpdate: boolean;
  private needsUpdate: boolean = false;

  constructor(
    particleSystem: ParticleSystem,
    private opacity: OpacityValue
  ) {
    super(particleSystem);
    this.needsOpacityUpdate = opacity instanceof Curve || opacity instanceof Range;
  }

  initialize(): void {
    this.opacities = new Float32Array(this.particleSystem.config.maxParticles);
    this.opacityAttribute = new THREE.InstancedBufferAttribute(this.opacities, 1);
  }

  onEmit(index: number): void {
    if (typeof this.opacity === 'number') {
      this.opacities[index] = this.opacity;
    } else if (this.opacity instanceof Range) {
      this.opacities[index] = this.opacity.lerp(0);
    } else if (this.opacity instanceof Curve) {
      this.opacities[index] = this.opacity.lerp(0);
    }
    this.needsUpdate = true;
  }

  onUpdate(index: number, _deltaTime: number, lifePercent: number): void {
    if (this.needsOpacityUpdate) {
      this.opacities[index] = (this.opacity as Range | Curve).lerp(lifePercent);
      this.needsUpdate = true;
    }
  }

  compactParticleData(targetIndex: number, sourceIndex: number): void {
    this.opacities[targetIndex] = this.opacities[sourceIndex];
    this.needsUpdate = true;
  }

  markAttributesNeedUpdate(): void {
    if (this.needsUpdate) {
      this.opacityAttribute.needsUpdate = true;
      this.needsUpdate = false;
    }
  }

  getAttributes(): Record<string, THREE.BufferAttribute> {
    return {
      instanceOpacity: this.opacityAttribute,
    };
  }

  getUniforms(): Record<string, { value: any }> {
    return {};
  }

  getDefines(): Record<string, boolean> {
    return {
      USE_OPACITY: true,
    };
  }
}