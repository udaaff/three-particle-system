import * as THREE from 'three';

import { Range } from '../Range';
import { ParticleComponent } from './ParticleComponent';

export class RotationComponent extends ParticleComponent {
  private rotations!: Float32Array;
  private rotationSpeeds!: Float32Array;
  private rotationRange: Range;

  constructor(particleSystem: any, rotationRange: Range) {
    super(particleSystem);
    this.rotationRange = rotationRange;
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

  getVertexShaderChunk(): string {
    return /* glsl */ `
      // Rotation
      vec2 rotatedUV = uv - 0.5;
      float c = cos(instanceRotation);
      float s = sin(instanceRotation);
      rotatedUV = vec2(
        rotatedUV.x * c - rotatedUV.y * s,
        rotatedUV.x * s + rotatedUV.y * c
      );
      vUv = rotatedUV + 0.5;
    `;
  }

  getDefines(): Record<string, boolean> {
    return {
      USE_ROTATION: true
    };
  }

  dispose(): void {
    // Очистка ресурсов, если необходимо
  }
}