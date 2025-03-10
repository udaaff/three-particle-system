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
import { VelocityFieldComponent } from './components/VelocityFieldComponent';

export type RenderMode =
  | { type: 'billboard' }
  | { type: 'velocity_aligned' }
  | { type: 'oriented'; normal: THREE.Vector3; up?: THREE.Vector3 };

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
      space?: 'local' | 'world';
    }
  | {
      type: 'box';
      size: { x: number; y: number; z: number };
      direction?: Direction;
      space?: 'local' | 'world';
    }
  | {
      type: 'sphere';
      radius: number;
      direction?: Direction;
      space?: 'local' | 'world';
    };

export interface ParticleSystemConfig {
  texture: THREE.Texture;
  maxParticles: number;
  blending?: Blending;
  transparent?: boolean;
  renderMode: RenderMode;
  emitter: EmitterType;
  particle: {
    lifetime: Range;
    color?: THREE.Color | ColorRange | ColorCurve;
    size?: number | Range | Curve;
    opacity?: number | Range | Curve;
    speedScale: number | Range;
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
    velocityField?: {
      path: CurvePath;
      influence?: number; // Сила влияния поля на скорость частиц (0-1), по умолчанию 0.3
    };
  };
}

export default class ParticleSystem extends THREE.Object3D {
  public config: ParticleSystemConfig;
  private particles!: THREE.Mesh;
  private geometry!: THREE.InstancedBufferGeometry;
  private positions!: Float32Array;
  private ages!: Float32Array;
  public activeParticles!: number;
  private velocities!: Float32Array;
  private components: ParticleComponent[] = [];

  private static readonly componentTypes = [
    TurbulenceComponent,
    GravityComponent,
    FrictionComponent,
    TextureRotationComponent,
    GeometryRotationComponent,
    ColorComponent,
    OpacityComponent,
    SizeComponent,
    VelocityFieldComponent
  ] as const;

  private readonly _position = new THREE.Vector3();
  private readonly _direction = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private readonly _up = new THREE.Vector3(0, 0, 1);
  private readonly _random = new THREE.Vector3();

  constructor(config: Partial<ParticleSystemConfig> = {}) {
    super();
    this.config = this.getDefaultConfig(config);

    // Инициализируем компоненты на основе конфига
    for (const ComponentType of ParticleSystem.componentTypes) {
      if (ComponentType.getConfigValue(this.config)) {
        this.addComponent(new ComponentType(this));
      }
    }

    this.setupParticleSystem();
  }

  private static createWhiteTexture(): THREE.Texture {
    const data = new Uint8Array([255, 255, 255, 255]); // RGBA (белый цвет)
    const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }

  getDefaultConfig(config?: Partial<ParticleSystemConfig>): ParticleSystemConfig {
    return {
      texture: ParticleSystem.createWhiteTexture(),
      maxParticles: 1000,
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
        speedScale: 0.2,
        textureRotation: range(-0.04, 0.04),
        geometryRotation: range(-0.04, 0.04),
      },
      ...config
    };
  }

  private setupParticleSystem(): void {
    const baseGeometry = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();

    this.geometry.index = baseGeometry.index;
    this.geometry.attributes.position = baseGeometry.attributes.position;
    this.geometry.attributes.uv = baseGeometry.attributes.uv;

    this.positions = new Float32Array(this.config.maxParticles * 3);
    this.ages = new Float32Array(this.config.maxParticles);
    this.velocities = new Float32Array(this.config.maxParticles * 3);

    this.geometry.setAttribute('instancePosition',
      new THREE.InstancedBufferAttribute(this.positions, 3));
    this.geometry.setAttribute('instanceVelocity',
      new THREE.InstancedBufferAttribute(this.velocities, 3));

    // Добавляем атрибуты от компонентов
    for (const component of this.components) {
      const attributes = component.getAttributes();
      for (const [name, attribute] of Object.entries(attributes)) {
        this.geometry.setAttribute(name, attribute);
      }
    }

    const material = this.createShaderMaterial(this.config.texture);

    this.particles = new THREE.Mesh(
      this.geometry,
      material,
    );
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

    // Добавляем define для мировых координат
    if (this.config.emitter.space === 'world') {
      defines.USE_WORLD_SPACE = true;
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
      transparent: this.config.transparent ?? true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: this.config.blending ?? THREE.NormalBlending,
    });
  }

  private getEmissionData(): { position: THREE.Vector3; direction: THREE.Vector3 } {
    const emitter = this.config.emitter;

    // Получаем позицию в зависимости от типа эмиттера
    switch (emitter.type) {
      case 'box': {
        this._position.set(
          (Math.random() - 0.5) * emitter.size.x,
          (Math.random() - 0.5) * emitter.size.y,
          (Math.random() - 0.5) * emitter.size.z
        );
        break;
      }
      case 'sphere': {
        this._direction.randomDirection();
        this._position.copy(this._direction).multiplyScalar(emitter.radius);
        break;
      }
      case 'point': {
        this._position.copy(emitter.position);
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

      // Создаем вектор в конусе
      this._direction.set(
        sinTheta * Math.cos(phi),
        sinTheta * Math.sin(phi),
        cosTheta
      );

      // Поворачиваем конус в направлении вектора
      this._quaternion.setFromUnitVectors(this._up, vector.normalize());
      this._direction.applyQuaternion(this._quaternion);

      // Добавляем случайность
      if (randomness > 0) {
        this._random.randomDirection().multiplyScalar(randomness);
        this._direction.lerp(this._random, Math.random() * 0.2);
        this._direction.normalize();
      }
    } else {
      this._direction.randomDirection();
    }

    // Преобразуем координаты если нужно
    if (emitter.space === 'world') {
      this._position.applyMatrix4(this.matrixWorld);
      this._direction.transformDirection(this.matrixWorld);
    }

    return { position: this._position, direction: this._direction };
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
      const speedScale = typeof this.config.particle.speedScale === 'number'
        ? this.config.particle.speedScale
        : this.config.particle.speedScale.lerp(Math.random());

      const curIdx0 = index * 3;
      const curIdx1 = curIdx0 + 1;
      const curIdx2 = curIdx0 + 2;

      // Устанавливаем текущую позицию равной начальной
      this.positions[curIdx0] = position.x;
      this.positions[curIdx1] = position.y;
      this.positions[curIdx2] = position.z;

      // Сохраняем направление как начальную скорость
      this.velocities[curIdx0] = direction.x * speedScale;
      this.velocities[curIdx1] = direction.y * speedScale;
      this.velocities[curIdx2] = direction.z * speedScale;

      this.ages[index] = 0;
    }

    this.activeParticles = endIndex;
    this.geometry.instanceCount = this.activeParticles;

    this.geometry.attributes.instancePosition.needsUpdate = true;
    this.geometry.attributes.instanceVelocity.needsUpdate = true;

    // Помечаем атрибуты компонентов как требующие обновления
    for (const component of this.components) {
      component.markAttributesNeedUpdate();
    }

    return actualCount;
  }

  updateParticles(deltaTime: number): void {
    let aliveCount = 0;
    const maxLifetime = this.config.particle.lifetime.to;
    const length = this.activeParticles;
    for (let i = 0; i < length; i++) {
      this.ages[i] += deltaTime;

      if (this.ages[i] < maxLifetime) {
        const dstIdx0 = aliveCount * 3;
        const dstIdx1 = dstIdx0 + 1;
        const dstIdx2 = dstIdx0 + 2;

        if (aliveCount !== i) {
          const srcIdx0 = i * 3;
          const srcIdx1 = srcIdx0 + 1;
          const srcIdx2 = srcIdx0 + 2;

          this.positions[dstIdx0] = this.positions[srcIdx0];
          this.positions[dstIdx1] = this.positions[srcIdx1];
          this.positions[dstIdx2] = this.positions[srcIdx2];

          this.velocities[dstIdx0] = this.velocities[srcIdx0];
          this.velocities[dstIdx1] = this.velocities[srcIdx1];
          this.velocities[dstIdx2] = this.velocities[srcIdx2];

          this.ages[aliveCount] = this.ages[i];

          for (const component of this.components) {
            component.compactParticleData(aliveCount, i);
          }
        }

        const lifePercent = this.ages[aliveCount] / maxLifetime;

        // Обновляем каждый компонент
        for (const component of this.components) {
          component.onUpdate(aliveCount, deltaTime, lifePercent);
        }

        this.positions[dstIdx0] += this.velocities[dstIdx0] * deltaTime;
        this.positions[dstIdx1] += this.velocities[dstIdx1] * deltaTime;
        this.positions[dstIdx2] += this.velocities[dstIdx2] * deltaTime;

        aliveCount++;
      }
    }

    this.activeParticles = aliveCount;
    this.geometry.instanceCount = aliveCount;

    this.geometry.attributes.instancePosition.needsUpdate = true;
    this.geometry.attributes.instanceVelocity.needsUpdate = true;

    // Помечаем атрибуты компонентов как требующие обновления
    for (const component of this.components) {
      component.markAttributesNeedUpdate();
    }
  }

  getDebugInfo(): { activeParticles: number; maxParticles: number; size?: number | Range | Curve; components: string[] } {
    return {
      activeParticles: this.activeParticles,
      maxParticles: this.config.maxParticles,
      size: this.config.particle.size,
      components: this.components.map(c => c.constructor.name)
    };
  }

  private addComponent(component: ParticleComponent): void {
    this.components.push(component);
    component.initialize();
  }
}
