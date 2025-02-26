import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem, { ParticleSystemConfig } from '../ParticleSystem';
import { PositioningComponent } from './PositioningComponent';

export class FrictionComponent extends ParticleComponent {
  private friction: number;
  private positioningComponent: PositioningComponent;

  static override getConfigValue(config: ParticleSystemConfig): number | undefined {
    return config.physics?.friction;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const friction = FrictionComponent.getConfigValue(system.config);
    if (!friction) throw new Error('Friction value is required for FrictionComponent');
    this.friction = friction;

    // Получаем PositioningComponent
    const positioningComponent = this.system.getComponent(PositioningComponent);
    if (!positioningComponent) {
      throw new Error('FrictionComponent requires PositioningComponent to be initialized first');
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
    const friction = Math.pow(1 - this.friction, deltaTime);
    this.positioningComponent.velocities[offset] *= friction;
    this.positioningComponent.velocities[offset + 1] *= friction;
    this.positioningComponent.velocities[offset + 2] *= friction;
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