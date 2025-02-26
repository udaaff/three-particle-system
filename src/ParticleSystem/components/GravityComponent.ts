import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem from '../ParticleSystem';

export class GravityComponent extends ParticleComponent {
  constructor(
    system: ParticleSystem,
    private gravity: THREE.Vector3
  ) {
    super(system);
  }

  initialize(): void {
    // Нет необходимости в инициализации
  }

  onEmit(_index: number): void {
    // Нет действий при эмиссии частиц
  }

  onUpdate(index: number, deltaTime: number, _lifePercent: number): void {
    const velocities = (this.system as any).velocities;
    velocities[index * 3] += this.gravity.x * deltaTime;
    velocities[index * 3 + 1] += this.gravity.y * deltaTime;
    velocities[index * 3 + 2] += this.gravity.z * deltaTime;
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