import * as THREE from 'three';
import { Range } from '../Range';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem, { ParticleSystemConfig } from '../ParticleSystem';

export class TextureRotationComponent extends ParticleComponent {
  private rotations!: Float32Array;
  private rotationSpeeds!: Float32Array;
  private rotationAttribute!: THREE.InstancedBufferAttribute;
  private range: Range;

  static override getConfigValue(config: ParticleSystemConfig): Range | undefined {
    return config.particle.textureRotation;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const range = TextureRotationComponent.getConfigValue(system.config);
    if (!range) throw new Error('Texture rotation range is required for TextureRotationComponent');
    this.range = range;
  }

  initialize(): void {
    this.rotations = new Float32Array(this.system.config.maxParticles);
    this.rotationSpeeds = new Float32Array(this.system.config.maxParticles);
    this.rotationAttribute = new THREE.InstancedBufferAttribute(this.rotations, 1);
  }

  onEmit(index: number): void {
    this.rotations[index] = 0;
    this.rotationSpeeds[index] = this.range.lerp(Math.random());
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