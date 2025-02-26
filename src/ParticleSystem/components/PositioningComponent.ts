import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import { EmitterType } from '../ParticleSystem';
import { CurvePath } from '../CurvePath';

export class PositioningComponent extends ParticleComponent {
  public positions!: Float32Array;
  private initialPositions!: Float32Array;
  public velocities!: Float32Array;
  private speedMultipliers!: Float32Array;
  private positionAttribute!: THREE.InstancedBufferAttribute;
  private velocityAttribute!: THREE.InstancedBufferAttribute;

  // Временные векторы для вычислений
  private tempPosition = new THREE.Vector3();
  private tempDirection = new THREE.Vector3();
  private tempQuaternion = new THREE.Quaternion();
  private upVector = new THREE.Vector3(0, 0, 1);

  initialize(): void {
    const maxParticles = this.system.config.maxParticles;
    this.positions = new Float32Array(maxParticles * 3);
    this.initialPositions = new Float32Array(maxParticles * 3);
    this.velocities = new Float32Array(maxParticles * 3);
    this.speedMultipliers = new Float32Array(maxParticles);

    this.positionAttribute = new THREE.InstancedBufferAttribute(this.positions, 3);
    this.velocityAttribute = new THREE.InstancedBufferAttribute(this.velocities, 3);
  }

  getAttributes(): { [key: string]: THREE.InstancedBufferAttribute } {
    return {
      instancePosition: this.positionAttribute,
      instanceVelocity: this.velocityAttribute
    };
  }

  getUniforms(): { [key: string]: { value: any } } {
    return {};
  }

  getDefines(): { [key: string]: boolean } {
    return {};
  }

  onEmit(index: number): void {
    const { position, direction } = this.getEmissionData(this.system.config.emitter);
    const offset = index * 3;

    // Сохраняем начальную позицию
    this.initialPositions[offset] = position.x;
    this.initialPositions[offset + 1] = position.y;
    this.initialPositions[offset + 2] = position.z;

    // Устанавливаем текущую позицию равной начальной
    this.positions[offset] = position.x;
    this.positions[offset + 1] = position.y;
    this.positions[offset + 2] = position.z;

    // Сохраняем случайный множитель скорости
    this.speedMultipliers[index] = this.system.config.particle.speedScale.lerp(Math.random());

    // Сохраняем направление как начальную скорость
    this.velocities[offset] = direction.x * this.speedMultipliers[index];
    this.velocities[offset + 1] = direction.y * this.speedMultipliers[index];
    this.velocities[offset + 2] = direction.z * this.speedMultipliers[index];
  }

  onUpdate(index: number, deltaTime: number, lifePercent: number): void {
    const offset = index * 3;

    if (this.system.config.path) {
      const point = this.system.config.path.getPoint(lifePercent);

      this.positions[offset] = this.initialPositions[offset] + point.x;
      this.positions[offset + 1] = this.initialPositions[offset + 1] + point.y;
      this.positions[offset + 2] = this.initialPositions[offset + 2] + point.z;
    } else {
      const speedMultiplier = this.speedMultipliers[index];

      this.positions[offset] += this.velocities[offset] * speedMultiplier * deltaTime;
      this.positions[offset + 1] += this.velocities[offset + 1] * speedMultiplier * deltaTime;
      this.positions[offset + 2] += this.velocities[offset + 2] * speedMultiplier * deltaTime;
    }
  }

  compactParticleData(newIndex: number, oldIndex: number): void {
    const newOffset = newIndex * 3;
    const oldOffset = oldIndex * 3;

    // Копируем позиции
    this.positions[newOffset] = this.positions[oldOffset];
    this.positions[newOffset + 1] = this.positions[oldOffset + 1];
    this.positions[newOffset + 2] = this.positions[oldOffset + 2];

    // Копируем начальные позиции
    this.initialPositions[newOffset] = this.initialPositions[oldOffset];
    this.initialPositions[newOffset + 1] = this.initialPositions[oldOffset + 1];
    this.initialPositions[newOffset + 2] = this.initialPositions[oldOffset + 2];

    // Копируем скорости
    this.velocities[newOffset] = this.velocities[oldOffset];
    this.velocities[newOffset + 1] = this.velocities[oldOffset + 1];
    this.velocities[newOffset + 2] = this.velocities[oldOffset + 2];

    // Копируем множители скорости
    this.speedMultipliers[newIndex] = this.speedMultipliers[oldIndex];
  }

  markAttributesNeedUpdate(): void {
    const attributes = this.getAttributes();
    for (const attribute of Object.values(attributes)) {
      attribute.needsUpdate = true;
    }
  }

  private getEmissionData(emitter: EmitterType): { position: THREE.Vector3; direction: THREE.Vector3 } {
    this.tempPosition.set(0, 0, 0);
    this.tempDirection.set(0, 0, 0);

    // Получаем позицию в зависимости от типа эмиттера
    switch (emitter.type) {
      case 'box': {
        this.tempPosition.set(
          (Math.random() - 0.5) * emitter.size.x,
          (Math.random() - 0.5) * emitter.size.y + emitter.size.y / 2,
          (Math.random() - 0.5) * emitter.size.z
        );
        break;
      }
      case 'sphere': {
        this.tempDirection.randomDirection();
        this.tempPosition.copy(this.tempDirection).multiplyScalar(emitter.radius);
        break;
      }
      case 'point': {
        this.tempPosition.copy(emitter.position);
        break;
      }
    }

    // Определяем направление
    if (emitter.direction) {
      const { vector, spread, randomness = 1 } = emitter.direction;

      // Создаем случайное направление в конусе
      const phi = Math.random() * Math.PI * 2;
      const cosSpread = Math.cos(spread);
      const cosTheta = cosSpread + (1 - cosSpread) * Math.random();
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);

      this.tempDirection.set(
        sinTheta * Math.cos(phi),
        sinTheta * Math.sin(phi),
        cosTheta
      );

      // Поворачиваем конус в направлении вектора
      this.tempQuaternion.setFromUnitVectors(this.upVector, vector.normalize());
      this.tempDirection.applyQuaternion(this.tempQuaternion);

      // Добавляем случайность
      if (randomness > 0) {
        const random = new THREE.Vector3().randomDirection().multiplyScalar(randomness);
        this.tempDirection.lerp(random, Math.random() * 0.2);
        this.tempDirection.normalize();
      }
    } else {
      this.tempDirection.randomDirection();
    }

    return {
      position: this.tempPosition.clone(),
      direction: this.tempDirection.clone()
    };
  }
}