import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem, { ParticleSystemConfig } from '../ParticleSystem';

export class GravityComponent extends ParticleComponent {
  private gravity: THREE.Vector3;

  static override getConfigValue(config: ParticleSystemConfig): THREE.Vector3 | undefined {
    return config.physics?.gravity;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const gravity = GravityComponent.getConfigValue(system.config);
    if (!gravity) throw new Error('Gravity vector is required for GravityComponent');
    this.gravity = gravity;
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