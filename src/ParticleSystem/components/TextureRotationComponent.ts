import * as THREE from 'three';
import { Range } from '../Range';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem from '../ParticleSystem';

export class TextureRotationComponent extends ParticleComponent {
  private rotations!: Float32Array;
  private rotationSpeeds!: Float32Array;

  constructor(
    particleSystem: ParticleSystem,
    private rotationRange: Range
  ) {
    super(particleSystem);
  }

  initialize(): void {
    this.rotations = new Float32Array(this.particleSystem.config.maxParticles);
    this.rotationSpeeds = new Float32Array(this.particleSystem.config.maxParticles);
  }

  onEmit(index: number): void {
    this.rotations[index] = 0;
    this.rotationSpeeds[index] = this.rotationRange.lerp(Math.random());
  }

  onUpdate(index: number, deltaTime: number): void {
    this.rotations[index] += this.rotationSpeeds[index] * deltaTime;
  }

  getAttributes(): Record<string, THREE.BufferAttribute> {
    return {
      instanceRotation: new THREE.InstancedBufferAttribute(this.rotations, 1)
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