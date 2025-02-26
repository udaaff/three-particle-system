import * as THREE from 'three';
import { Range } from '../Range';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem from '../ParticleSystem';

export class TextureRotationComponent extends ParticleComponent {
  private rotations!: Float32Array;
  private rotationSpeeds!: Float32Array;
  private rotationAttribute!: THREE.InstancedBufferAttribute;

  constructor(
    particleSystem: ParticleSystem,
    private rotationRange: Range
  ) {
    super(particleSystem);
  }

  initialize(): void {
    this.rotations = new Float32Array(this.system.config.maxParticles);
    this.rotationSpeeds = new Float32Array(this.system.config.maxParticles);
    this.rotationAttribute = new THREE.InstancedBufferAttribute(this.rotations, 1);
  }

  onEmit(index: number): void {
    this.rotations[index] = 0;
    this.rotationSpeeds[index] = this.rotationRange.lerp(Math.random());
  }

  onUpdate(index: number, deltaTime: number, _lifePercent: number): void {
    this.rotations[index] += this.rotationSpeeds[index] * deltaTime;
  }

  compactParticleData(targetIndex: number, sourceIndex: number): void {
    this.rotations[targetIndex] = this.rotations[sourceIndex];
    this.rotationSpeeds[targetIndex] = this.rotationSpeeds[sourceIndex];
  }

  markAttributesNeedUpdate(): void {
    this.rotationAttribute.needsUpdate = true;
  }

  getAttributes(): Record<string, THREE.BufferAttribute> {
    return {
      instanceRotation: this.rotationAttribute
    };
  }

  getUniforms(): Record<string, { value: any }> {
    return {};
  }

  getDefines(): Record<string, boolean> {
    return {
      USE_TEXTURE_ROTATION: true
    };
  }
}