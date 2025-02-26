import * as THREE from 'three';
import { Blending } from 'three';

import { ParticleComponent } from './components/ParticleComponent';
import { TurbulenceComponent } from './components/TurbulenceComponent';
import { TextureRotationComponent } from './components/TextureRotationComponent';
import { GeometryRotationComponent } from './components/GeometryRotationComponent';
import { ColorComponent } from './components/ColorComponent';
import { GravityComponent } from './components/GravityComponent';
import { FrictionComponent } from './components/FrictionComponent';
import { CurvePath } from './CurvePath';
import { ColorCurve, ColorRange, Curve, curve, Range, range } from './Range';
import vertexShader from './shaders/particle.vert.glsl';
import fragmentShader from './shaders/particle.frag.glsl';
import { OpacityComponent } from './components/OpacityComponent';
import { SizeComponent } from './components/SizeComponent';

export type RenderMode =
  | { type: 'billboard' }
  | { type: 'velocity_aligned' }
  | { type: 'oriented', normal: THREE.Vector3, up?: THREE.Vector3 };

export type Direction = {
  vector: THREE.Vector3;   // Базовое направление
  spread: number;          // Угол разброса в радианах
  randomness?: number;     // Множитель случайности (0-1), по умолчанию 1
};

export type EmitterType =
  | {
      type: 'point';
      position: THREE.Vector3;
      direction?: Direction;
    }
  | {
      type: 'box';
      size: { x: number; y: number; z: number };
      direction?: Direction;
    }
  | {
      type: 'sphere';
      radius: number;
      direction?: Direction;
    };

export interface ParticleSystemConfig {
  texture: THREE.Texture;
  maxParticles: number;
  blending?: Blending;
  renderMode: RenderMode;
  emitter: EmitterType;
  particle: {
    lifetime: Range;
    color?: THREE.Color | ColorRange | ColorCurve;
    size?: number | Range | Curve;
    opacity?: number | Range | Curve;
    speedScale: Range;
    textureRotation?: Range;  // Скорость вращения текстуры в радианах/сек
    geometryRotation?: Range; // Скорость вращения геометрии в радианах/сек
  };
  physics?: {
    gravity?: THREE.Vector3;
    friction?: number;
    turbulence?: {
      strength: number;
      scale: number;
      speed: number;
    };
    vortex?: {
      strength: number;
      center: THREE.Vector3;
    };
  };
  path?: CurvePath;
}

export default class ParticleSystem extends THREE.Object3D {
  public config: ParticleSystemConfig;
  private particles!: THREE.InstancedMesh;
  private positions!: Float32Array;
  private scales!: Float32Array;
  private ages!: Float32Array;
  public activeParticles!: number;
  private initialPositions!: Float32Array;
  private speedMultipliers!: Float32Array;
  private velocities!: Float32Array;
  private components: ParticleComponent[] = [];

  constructor(config: Partial<ParticleSystemConfig> = {}) {
    super();
    this.config = this.getDefaultConfig(config);

    // Инициализируем компоненты на основе конфига
    if (this.config.physics?.turbulence) {
      this.addComponent(new TurbulenceComponent(this, this.config.physics.turbulence));
    }

    // Добавляем компонент гравитации, если задан
    if (this.config.physics?.gravity) {
      this.addComponent(new GravityComponent(this, this.config.physics.gravity));
    }

    // Добавляем компонент трения, если задан
    if (this.config.physics?.friction) {
      this.addComponent(new FrictionComponent(this, this.config.physics.friction));
    }

    // Добавляем компоненты вращения, если заданы соответствующие параметры
    if (this.config.particle.textureRotation) {
      this.addComponent(new TextureRotationComponent(this, this.config.particle.textureRotation));
    }
    if (this.config.particle.geometryRotation) {
      this.addComponent(new GeometryRotationComponent(this, this.config.particle.geometryRotation));
    }

    // Добавляем компонент цвета
    if (this.config.particle.color) {
      this.addComponent(new ColorComponent(this, this.config.particle.color));
    }

    // Добавляем компонент прозрачности
    if (this.config.particle.opacity) {
      this.addComponent(new OpacityComponent(this, this.config.particle.opacity));
    }

    if (this.config.particle.size) {
      this.addComponent(new SizeComponent(this, this.config.particle.size));
    }

    this.setupParticleSystem();
  }

  getDefaultConfig(config?: Partial<ParticleSystemConfig>): ParticleSystemConfig {
    return {
      texture: new THREE.Texture(),
      maxParticles: 50000,
      renderMode: {
        type: 'billboard'
      },
      emitter: {
        type: 'box',
        size: {
          x: 6,
          y: 1,
          z: 30
        }
      },
      particle: {
        lifetime: range(5, 10),
        color: new THREE.Color(0, 0, 1),
        opacity: curve([
          [0, 0],
          [0.2, 0.2],
          [0.8, 0.2],
          [1, 0]
        ]),
        size: range(8, 8),
        speedScale: range(0, 0.2),
        textureRotation: range(-0.04, 0.04),
        geometryRotation: range(-0.04, 0.04),
      },
      physics: {
        friction: 0.01,
        vortex: {
          strength: 0.1,
          center: new THREE.Vector3(0, 0.5, 0)
        }
      },
      ...config
    };
  }

  private setupParticleSystem(): void {
    const baseGeometry = new THREE.PlaneGeometry(1, 1);
    const instancedGeometry = new THREE.InstancedBufferGeometry();

    instancedGeometry.index = baseGeometry.index;
    instancedGeometry.attributes.position = baseGeometry.attributes.position;
    instancedGeometry.attributes.uv = baseGeometry.attributes.uv;

    this.positions = new Float32Array(this.config.maxParticles * 3);
    this.scales = new Float32Array(this.config.maxParticles);
    this.ages = new Float32Array(this.config.maxParticles);
    this.initialPositions = new Float32Array(this.config.maxParticles * 3);
    this.speedMultipliers = new Float32Array(this.config.maxParticles);
    this.velocities = new Float32Array(this.config.maxParticles * 3);

    instancedGeometry.setAttribute('instancePosition',
      new THREE.InstancedBufferAttribute(this.positions, 3));
    instancedGeometry.setAttribute('instanceScale',
      new THREE.InstancedBufferAttribute(this.scales, 1));
    instancedGeometry.setAttribute('instanceVelocity',
      new THREE.InstancedBufferAttribute(this.velocities, 3));

    // Добавляем атрибуты от компонентов
    for (const component of this.components) {
      const attributes = component.getAttributes();
      for (const [name, attribute] of Object.entries(attributes)) {
        instancedGeometry.setAttribute(name, attribute);
      }
    }

    const material = this.createShaderMaterial(this.config.texture);

    this.particles = new THREE.InstancedMesh(
      instancedGeometry,
      material,
      this.config.maxParticles
    );
    this.particles.frustumCulled = false;
    this.add(this.particles);

    this.activeParticles = 0;
  }

  private createShaderMaterial(texture: THREE.Texture): THREE.RawShaderMaterial {
    const defines: { [key: string]: boolean } = {};

    // Устанавливаем define в зависимости от режима рендеринга
    switch (this.config.renderMode.type) {
      case 'billboard':
        defines.RENDER_MODE_BILLBOARD = true;
        break;
      case 'velocity_aligned':
        defines.RENDER_MODE_VELOCITY_ALIGNED = true;
        break;
      case 'oriented':
        defines.RENDER_MODE_ORIENTED = true;
        if (this.config.renderMode.up) {
          defines.USE_UP = true;
        }
        break;
    }

    // Добавляем defines от компонентов
    for (const component of this.components) {
      Object.assign(defines, component.getDefines());
    }

    // Собираем униформы от всех компонентов
    const uniforms: Record<string, { value: any }> = {
      uTexture: { value: texture }
    };

    // Добавляем униформы для oriented режима
    if (this.config.renderMode.type === 'oriented') {
      uniforms.uNormal = { value: this.config.renderMode.normal };
      if (this.config.renderMode.up) {
        uniforms.uUp = { value: this.config.renderMode.up };
      }
    }

    for (const component of this.components) {
      Object.assign(uniforms, component.getUniforms());
    }

    return new THREE.RawShaderMaterial({
      defines,
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: this.config.blending ?? THREE.NormalBlending,
    });
  }

  private getEmissionData(): { position: THREE.Vector3; direction: THREE.Vector3 } {
    const position = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const emitter = this.config.emitter;

    // Получаем позицию в зависимости от типа эмиттера
    switch (emitter.type) {
      case 'box': {
        position.set(
          (Math.random() - 0.5) * emitter.size.x,
          (Math.random() - 0.5) * emitter.size.y + emitter.size.y / 2,
          (Math.random() - 0.5) * emitter.size.z
        );
        break;
      }
      case 'sphere': {
        direction.randomDirection();
        position.copy(direction).multiplyScalar(emitter.radius);
        break;
      }
      case 'point': {
        position.copy(emitter.position);
        break;
      }
    }

    // Определяем направление
    if (emitter.direction) {
      const { vector, spread, randomness = 1 } = emitter.direction;

      // Создаем случайное направление в конусе
      const phi = Math.random() * Math.PI * 2; // Угол вокруг оси
      const cosSpread = Math.cos(spread);
      const cosTheta = cosSpread + (1 - cosSpread) * Math.random(); // Интерполяция между cos(spread) и 1
      const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);

      // Создаем вектор в конусе
      direction.set(
        sinTheta * Math.cos(phi),
        sinTheta * Math.sin(phi),
        cosTheta
      );

      // Поворачиваем конус в направлении вектора
      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 0, 1);
      quaternion.setFromUnitVectors(up, vector.normalize());
      direction.applyQuaternion(quaternion);

      // Добавляем случайность
      if (randomness > 0) {
        const random = new THREE.Vector3().randomDirection().multiplyScalar(randomness);
        direction.lerp(random, Math.random() * 0.2);
        direction.normalize();
      }
    } else {
      // Если направление не задано, используем случайное
      direction.randomDirection();
    }

    return { position, direction };
  }

  emit(count: number): number {
    const startIndex = this.activeParticles;
    const endIndex = Math.min(startIndex + count, this.config.maxParticles);
    const actualCount = endIndex - startIndex;

    for (let i = 0; i < actualCount; i++) {
      const index = startIndex + i;

      // Вызываем onEmit для каждого компонента
      for (const component of this.components) {
        component.onEmit(index);
      }

      const { position, direction } = this.getEmissionData();

      // Сохраняем начальную позицию
      this.initialPositions[index * 3] = position.x;
      this.initialPositions[index * 3 + 1] = position.y;
      this.initialPositions[index * 3 + 2] = position.z;

      // Сохраняем случайный множитель скорости
      this.speedMultipliers[index] = this.config.particle.speedScale.lerp(Math.random());

      // Устанавливаем текущую позицию равной начальной
      this.positions[index * 3] = position.x;
      this.positions[index * 3 + 1] = position.y;
      this.positions[index * 3 + 2] = position.z;

      // Сохраняем направление как начальную скорость
      this.velocities[index * 3] = direction.x * this.speedMultipliers[index];
      this.velocities[index * 3 + 1] = direction.y * this.speedMultipliers[index];
      this.velocities[index * 3 + 2] = direction.z * this.speedMultipliers[index];

      this.ages[index] = 0;
    }

    this.activeParticles = endIndex;

    this.particles.geometry.attributes.instancePosition.needsUpdate = true;
    this.particles.geometry.attributes.instanceVelocity.needsUpdate = true;

    // Помечаем атрибуты компонентов как требующие обновления
    for (const component of this.components) {
      component.markAttributesNeedUpdate();
    }

    return actualCount;
  }

  updateParticles(deltaTime: number): void {
    let currentIndex = 0;

    for (let i = 0; i < this.activeParticles; i++) {
      this.ages[i] += deltaTime;

      if (this.ages[i] < this.config.particle.lifetime.to) {
        if (currentIndex !== i) {
          // Копируем все параметры частицы
          this.positions[currentIndex * 3] = this.positions[i * 3];
          this.positions[currentIndex * 3 + 1] = this.positions[i * 3 + 1];
          this.positions[currentIndex * 3 + 2] = this.positions[i * 3 + 2];

          this.velocities[currentIndex * 3] = this.velocities[i * 3];
          this.velocities[currentIndex * 3 + 1] = this.velocities[i * 3 + 1];
          this.velocities[currentIndex * 3 + 2] = this.velocities[i * 3 + 2];

          this.initialPositions[currentIndex * 3] = this.initialPositions[i * 3];
          this.initialPositions[currentIndex * 3 + 1] = this.initialPositions[i * 3 + 1];
          this.initialPositions[currentIndex * 3 + 2] = this.initialPositions[i * 3 + 2];

          this.ages[currentIndex] = this.ages[i];
          this.speedMultipliers[currentIndex] = this.speedMultipliers[i];

          // Копируем данные из компонентов
          for (const component of this.components) {
            component.compactParticleData(currentIndex, i);
          }
        }

        const lifePercent = this.ages[currentIndex] / this.config.particle.lifetime.to;

        // Обновляем каждый компонент
        for (const component of this.components) {
          component.onUpdate(currentIndex, deltaTime, lifePercent);
        }

        if (this.config.path) {
          const point = this.config.path.getPoint(lifePercent);

          this.positions[currentIndex * 3] = this.initialPositions[currentIndex * 3] + point.x;
          this.positions[currentIndex * 3 + 1] = this.initialPositions[currentIndex * 3 + 1] + point.y;
          this.positions[currentIndex * 3 + 2] = this.initialPositions[currentIndex * 3 + 2] + point.z;
        } else {
          const speedMultiplier = this.speedMultipliers[currentIndex];
          // Используем только направление и множитель скорости
          this.positions[currentIndex * 3] += this.velocities[currentIndex * 3] * speedMultiplier * deltaTime;
          this.positions[currentIndex * 3 + 1] += this.velocities[currentIndex * 3 + 1] * speedMultiplier * deltaTime;
          this.positions[currentIndex * 3 + 2] += this.velocities[currentIndex * 3 + 2] * speedMultiplier * deltaTime;
        }

        currentIndex++;
      }
    }

    this.activeParticles = currentIndex;
    this.particles.count = currentIndex;

    this.particles.geometry.attributes.instancePosition.needsUpdate = true;
    this.particles.geometry.attributes.instanceVelocity.needsUpdate = true;

    // Помечаем атрибуты компонентов как требующие обновления
    for (const component of this.components) {
      component.markAttributesNeedUpdate();
    }
  }

  getDebugInfo(): { activeParticles: number; maxParticles: number; size?: number | Range | Curve } {
    return {
      activeParticles: this.activeParticles,
      maxParticles: this.config.maxParticles,
      size: this.config.particle.size
    };
  }

  addComponent(component: ParticleComponent): void {
    this.components.push(component);
    component.initialize();
  }
}
