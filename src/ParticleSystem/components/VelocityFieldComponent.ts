import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem, { ParticleSystemConfig } from '../ParticleSystem';
import { CurvePath } from '../CurvePath';

type VelocityFieldConfig = {
  path: CurvePath;
  influence?: number;
};

export class VelocityFieldComponent extends ParticleComponent {
  private readonly _velocity = new THREE.Vector3();
  private readonly path: CurvePath;
  private readonly influence: number;

  static override getConfigValue(config: ParticleSystemConfig): VelocityFieldConfig | undefined {
    return config.physics?.velocityField;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const config = VelocityFieldComponent.getConfigValue(system.config);
    if (!config) throw new Error('Velocity field config is required for VelocityFieldComponent');

    this.path = config.path;
    this.influence = config.influence ?? 0.3;
  }

  initialize(): void {
    // Нет необходимости в инициализации дополнительных буферов
  }

  onUpdate(index: number, _deltaTime: number, lifePercent: number): void {
    const tangent = this.path.getTangent(lifePercent);
    const velocities = (this.system as any).velocities;

    // Получаем текущую скорость частицы
    this._velocity.set(
      velocities[index * 3],
      velocities[index * 3 + 1],
      velocities[index * 3 + 2]
    );

    // Плавное приближение скорости к касательной (LERP)
    this._velocity.lerp(tangent.multiplyScalar(this._velocity.length()), this.influence);

    // Обновляем скорость частицы
    velocities[index * 3] = this._velocity.x;
    velocities[index * 3 + 1] = this._velocity.y;
    velocities[index * 3 + 2] = this._velocity.z;
  }

  getDefines(): Record<string, boolean> {
    return {};
  }

  getUniforms(): Record<string, THREE.IUniform> {
    return {};
  }

  getAttributes(): Record<string, THREE.BufferAttribute> {
    return {};
  }

  markAttributesNeedUpdate(): void {
    // Нет необходимости в обновлении атрибутов
  }

  onEmit(_index: number): void {
    // Нет необходимости в дополнительной инициализации при эмиссии
  }

  compactParticleData(_targetIndex: number, _sourceIndex: number): void {
    // Нет необходимости в дополнительном копировании данных
  }
}