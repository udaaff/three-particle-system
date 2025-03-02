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
  private readonly _path: CurvePath;
  private readonly _influence: number;
  private readonly _cachedTangents: THREE.Vector3[];
  private readonly _tangentResolution: number = 100; // Количество точек для кэширования
  private readonly _temp = new THREE.Vector3();

  static override getConfigValue(config: ParticleSystemConfig): VelocityFieldConfig | undefined {
    return config.physics?.velocityField;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const config = this.system.config.physics?.velocityField;
    if (!config) throw new Error('VelocityField config is required');

    this._path = config.path;
    this._influence = config.influence ?? 0.3;
    this._cachedTangents = this._precalculateTangents();
  }

  private _precalculateTangents(): THREE.Vector3[] {
    const tangents: THREE.Vector3[] = [];
    for (let i = 0; i < this._tangentResolution; i++) {
      const t = i / (this._tangentResolution - 1);
      tangents.push(this._path.getTangent(t));
    }
    return tangents;
  }

  private _getTangentFromCache(lifePercent: number): THREE.Vector3 {
    const index = Math.min(
      Math.floor(lifePercent * (this._tangentResolution - 1)),
      this._tangentResolution - 1
    );
    return this._temp.copy(this._cachedTangents[index]);
  }

  initialize(): void {
    // Нет необходимости в инициализации дополнительных буферов
  }

  onUpdate(index: number, _deltaTime: number, lifePercent: number): void {
    const tangent = this._getTangentFromCache(lifePercent);
    const velocities = (this.system as any).velocities;

    // Получаем текущую скорость частицы
    this._velocity.set(
      velocities[index * 3],
      velocities[index * 3 + 1],
      velocities[index * 3 + 2]
    );

    // Плавное приближение скорости к касательной (LERP)
    this._velocity.lerp(tangent.multiplyScalar(this._velocity.length()), this._influence);

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