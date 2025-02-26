import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem from '../ParticleSystem';

export class FrictionComponent extends ParticleComponent {
  constructor(
    particleSystem: ParticleSystem,
    private friction: number
  ) {
    super(particleSystem);
  }

  initialize(): void {
    // Нет необходимости в инициализации
  }

  onEmit(_index: number): void {
    // Нет действий при эмиссии частиц
  }

  onUpdate(index: number, deltaTime: number, _lifePercent: number): void {
    const velocities = (this.particleSystem as any).velocities;
    const friction = Math.pow(1 - this.friction, deltaTime);
    velocities[index * 3] *= friction;
    velocities[index * 3 + 1] *= friction;
    velocities[index * 3 + 2] *= friction;
  }

  compactParticleData(_targetIndex: number, _sourceIndex: number): void {
    // Нет необходимости в копировании данных
  }

  markAttributesNeedUpdate(): void {
    // Нет атрибутов для обновления
  }

  getAttributes(): Record<string, THREE.BufferAttribute> {
    return {};
  }

  getUniforms(): Record<string, { value: any }> {
    return {};
  }

  getDefines(): Record<string, boolean> {
    return {};
  }
}