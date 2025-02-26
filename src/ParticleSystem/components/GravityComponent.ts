import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem, { ParticleSystemConfig } from '../ParticleSystem';
import { PositioningComponent } from './PositioningComponent';

export class GravityComponent extends ParticleComponent {
  private gravity: THREE.Vector3;
  private positioningComponent: PositioningComponent;

  static override getConfigValue(config: ParticleSystemConfig): THREE.Vector3 | undefined {
    return config.physics?.gravity;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const gravity = GravityComponent.getConfigValue(system.config);
    if (!gravity) throw new Error('Gravity vector is required for GravityComponent');
    this.gravity = gravity;

    // Получаем PositioningComponent через новый метод
    const positioningComponent = this.system.getComponent(PositioningComponent);
    if (!positioningComponent) {
      throw new Error('GravityComponent requires PositioningComponent to be initialized first');
    }
    this.positioningComponent = positioningComponent;
  }

  initialize(): void {
    // Нет необходимости в инициализации
  }

  onEmit(_index: number): void {
    // Нет действий при эмиссии частиц
  }

  onUpdate(index: number, deltaTime: number, _lifePercent: number): void {
    const offset = index * 3;
    this.positioningComponent.velocities[offset] += this.gravity.x * deltaTime;
    this.positioningComponent.velocities[offset + 1] += this.gravity.y * deltaTime;
    this.positioningComponent.velocities[offset + 2] += this.gravity.z * deltaTime;
  }

  compactParticleData(_targetIndex: number, _sourceIndex: number): void {
    // Нет необходимости в копировании данных, так как это делает PositioningComponent
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