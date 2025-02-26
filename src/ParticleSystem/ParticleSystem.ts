import * as THREE from 'three';
import { Blending } from 'three';

import { ParticleComponent } from './components/ParticleComponent';
import { TurbulenceComponent } from './components/TurbulenceComponent';
import { TextureRotationComponent } from './components/TextureRotationComponent';
import { GeometryRotationComponent } from './components/GeometryRotationComponent';
import { CurvePath } from './CurvePath';
import { ParticleSystemDebug } from './ParticleSystemDebug';
import { ColorCurve, ColorRange, Curve, curve, Range, range } from './Range';
import vertexShader from './shaders/particle.vert.glsl';
import fragmentShader from './shaders/particle.frag.glsl';

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
  debug: boolean;
  renderMode: RenderMode;
  emitter: EmitterType;
  particle: {
    lifetime: Range;
    color?: THREE.Color | ColorRange | ColorCurve;
    size: Range;
    opacity: Range | Curve;
    speedScale: Range;
    textureRotation?: Range;  // Скорость вращения текстуры в радианах/сек
    geometryRotation?: Range; // Скорость вращения геометрии в радианах/сек
  };
  _physics: {
    gravity: THREE.Vector3;
    friction: number;
    turbulence?: {
      strength: number;
      scale: number;
      speed: number;
    };
    vortex: {
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
  private opacities!: Float32Array;
  private ages!: Float32Array;
  private activeParticles!: number;
  private colors!: Float32Array;
  private initialPositions!: Float32Array;
  private needsColorUpdate: boolean = false; // Флаг для определения нужно ли обновлять цвет
  private speedMultipliers!: Float32Array;
  private velocities!: Float32Array;
  private debug?: ParticleSystemDebug;
  private textureRotations!: Float32Array;      // Текущий угол поворота текстуры
  private textureRotationSpeeds!: Float32Array; // Скорость вращения текстуры
  private geometryRotations!: Float32Array;      // Текущий угол поворота геометрии
  private geometryRotationSpeeds!: Float32Array; // Скорость вращения геометрии
  private components: ParticleComponent[] = [];
  private lastUpdateTime: number = 0;

  constructor(config: Partial<ParticleSystemConfig> = {}) {
    super();
    this.config = this.getDefaultConfig(config);

    if (this.config.debug) {
      this.debug = new ParticleSystemDebug(this.config, this);
    }

    // Инициализируем компоненты на основе конфига
    if (this.config._physics.turbulence) {
      this.addComponent(new TurbulenceComponent(this, this.config._physics.turbulence));
    }

    // Добавляем компоненты вращения, если заданы соответствующие параметры
    if (this.config.particle.textureRotation) {
      this.addComponent(new TextureRotationComponent(this, this.config.particle.textureRotation));
    }
    if (this.config.particle.geometryRotation) {
      this.addComponent(new GeometryRotationComponent(this, this.config.particle.geometryRotation));
    }

    this.setupParticleSystem();
  }

  getDefaultConfig(config?: Partial<ParticleSystemConfig>): ParticleSystemConfig {
    return {
      texture: new THREE.Texture(),
      maxParticles: 50000,
      debug: true,
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
      _physics: {
        gravity: new THREE.Vector3(0, 0.05, 0),
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
    this.opacities = new Float32Array(this.config.maxParticles);
    this.ages = new Float32Array(this.config.maxParticles);
    this.colors = new Float32Array(this.config.maxParticles * 3);
    this.initialPositions = new Float32Array(this.config.maxParticles * 3);
    this.speedMultipliers = new Float32Array(this.config.maxParticles);
    this.velocities = new Float32Array(this.config.maxParticles * 3);
    this.textureRotations = new Float32Array(this.config.maxParticles);
    this.textureRotationSpeeds = new Float32Array(this.config.maxParticles);
    this.geometryRotations = new Float32Array(this.config.maxParticles);
    this.geometryRotationSpeeds = new Float32Array(this.config.maxParticles);

    instancedGeometry.setAttribute('instancePosition',
      new THREE.InstancedBufferAttribute(this.positions, 3));
    instancedGeometry.setAttribute('instanceScale',
      new THREE.InstancedBufferAttribute(this.scales, 1));
    instancedGeometry.setAttribute('instanceOpacity',
      new THREE.InstancedBufferAttribute(this.opacities, 1));
    instancedGeometry.setAttribute('instanceColor',
      new THREE.InstancedBufferAttribute(this.colors, 3));
    instancedGeometry.setAttribute('instanceRotation',
      new THREE.InstancedBufferAttribute(this.textureRotations, 1));
    instancedGeometry.setAttribute('instanceGeometryRotation',
      new THREE.InstancedBufferAttribute(this.geometryRotations, 1));
    instancedGeometry.setAttribute('instanceVelocity',
      new THREE.InstancedBufferAttribute(this.velocities, 3));

    const material = this.createShaderMaterial(this.config.texture);

    this.particles = new THREE.InstancedMesh(
      instancedGeometry,
      material,
      this.config.maxParticles
    );
    this.particles.frustumCulled = false;
    this.add(this.particles);

    this.activeParticles = 0;

    // Определяем при инициализации, нужно ли обновлять цвет
    this.needsColorUpdate = this.config.particle.color instanceof ColorCurve
      || this.config.particle.color instanceof ColorRange;
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


      this.scales[index] = this.config.particle.size.lerp(0);
      this.opacities[index] = this.config.particle.opacity.lerp(0);
      this.ages[index] = 0;

      // Сохраняем случайную скорость вращения
      this.textureRotations[index] = 0;
      this.textureRotationSpeeds[index] = this.config.particle.textureRotation?.lerp(Math.random()) || 0;
      this.geometryRotations[index] = 0;
      this.geometryRotationSpeeds[index] = this.config.particle.geometryRotation?.lerp(Math.random()) || 0;

      // Устанавливаем цвета для новой частицы
      if (!this.config.particle.color) {
        // Используем цвет текстуры
        this.colors[index * 3] = -1;
      } else if (this.config.particle.color instanceof THREE.Color) {
        // Один цвет
        const color = this.config.particle.color;
        this.colors[index * 3] = color.r;
        this.colors[index * 3 + 1] = color.g;
        this.colors[index * 3 + 2] = color.b;
      } else if (this.config.particle.color instanceof ColorCurve) {
        // Кривая цвета
        const color = this.config.particle.color.lerp(0);
        this.colors[index * 3] = color.r;
        this.colors[index * 3 + 1] = color.g;
        this.colors[index * 3 + 2] = color.b;
      } else {
        // Range цвета
        const { from } = this.config.particle.color;
        this.colors[index * 3] = from.r;
        this.colors[index * 3 + 1] = from.g;
        this.colors[index * 3 + 2] = from.b;
      }
    }

    this.activeParticles = endIndex;

    this.particles.geometry.attributes.instancePosition.needsUpdate = true;
    this.particles.geometry.attributes.instanceScale.needsUpdate = true;
    this.particles.geometry.attributes.instanceOpacity.needsUpdate = true;
    this.particles.geometry.attributes.instanceColor.needsUpdate = true;
    this.particles.geometry.attributes.instanceRotation.needsUpdate = true;
    this.particles.geometry.attributes.instanceGeometryRotation.needsUpdate = true;
    this.particles.geometry.attributes.instanceVelocity.needsUpdate = true;

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

          // Копируем скорости
          this.velocities[currentIndex * 3] = this.velocities[i * 3];
          this.velocities[currentIndex * 3 + 1] = this.velocities[i * 3 + 1];
          this.velocities[currentIndex * 3 + 2] = this.velocities[i * 3 + 2];

          this.initialPositions[currentIndex * 3] = this.initialPositions[i * 3];
          this.initialPositions[currentIndex * 3 + 1] = this.initialPositions[i * 3 + 1];
          this.initialPositions[currentIndex * 3 + 2] = this.initialPositions[i * 3 + 2];

          this.scales[currentIndex] = this.scales[i];
          this.opacities[currentIndex] = this.opacities[i];
          this.ages[currentIndex] = this.ages[i];
          this.speedMultipliers[currentIndex] = this.speedMultipliers[i];
          this.textureRotations[currentIndex] = this.textureRotations[i];
          this.textureRotationSpeeds[currentIndex] = this.textureRotationSpeeds[i];
          this.geometryRotations[currentIndex] = this.geometryRotations[i];
          this.geometryRotationSpeeds[currentIndex] = this.geometryRotationSpeeds[i];

          // Копируем цвета покомпонентно
          this.colors[currentIndex * 3] = this.colors[i * 3];
          this.colors[currentIndex * 3 + 1] = this.colors[i * 3 + 1];
          this.colors[currentIndex * 3 + 2] = this.colors[i * 3 + 2];
        }

        // Обновляем скорости под действием гравитации
        this.velocities[currentIndex * 3] += this.config._physics.gravity.x * deltaTime;
        this.velocities[currentIndex * 3 + 1] += this.config._physics.gravity.y * deltaTime;
        this.velocities[currentIndex * 3 + 2] += this.config._physics.gravity.z * deltaTime;

        // Применяем трение
        this.velocities[currentIndex * 3] *= (1.0 - this.config._physics.friction * deltaTime);
        this.velocities[currentIndex * 3 + 1] *= (1.0 - this.config._physics.friction * deltaTime);
        this.velocities[currentIndex * 3 + 2] *= (1.0 - this.config._physics.friction * deltaTime);

        const lifePercent = this.ages[currentIndex] / this.config.particle.lifetime.to;

        // Обновляем каждый компонент
        for (const component of this.components) {
          component.onUpdate(currentIndex, deltaTime, lifePercent);
        }

        // Обновляем угол поворота используя скорость
        this.textureRotations[currentIndex] += this.textureRotationSpeeds[currentIndex] * deltaTime;
        this.geometryRotations[currentIndex] += this.geometryRotationSpeeds[currentIndex] * deltaTime;

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

        this.scales[currentIndex] = this.config.particle.size.lerp(lifePercent);
        this.opacities[currentIndex] = this.config.particle.opacity.lerp(lifePercent);

        // Обновляем цвет только если это необходимо (Range или ColorCurve)
        if (this.needsColorUpdate
          && (this.config.particle.color instanceof ColorCurve
            || this.config.particle.color instanceof ColorRange)
        ) {
          const color = this.config.particle.color.lerp(lifePercent);
          this.colors[currentIndex * 3] = color.r;
          this.colors[currentIndex * 3 + 1] = color.g;
          this.colors[currentIndex * 3 + 2] = color.b;
        }

        currentIndex++;
      }
    }

    this.activeParticles = currentIndex;
    this.particles.count = currentIndex;

    if (this.config.debug && this.debug) {
      this.debug.updateParticleCount(this.activeParticles, this.config.maxParticles);
      const size = this.config.particle.size;
      this.debug.updatePixelCount(size, this.activeParticles);
    }

    this.particles.geometry.attributes.instancePosition.needsUpdate = true;
    this.particles.geometry.attributes.instanceScale.needsUpdate = true;
    this.particles.geometry.attributes.instanceOpacity.needsUpdate = true;
    this.particles.geometry.attributes.instanceColor.needsUpdate = true;
    this.particles.geometry.attributes.instanceRotation.needsUpdate = true;
    this.particles.geometry.attributes.instanceGeometryRotation.needsUpdate = true;
    this.particles.geometry.attributes.instanceVelocity.needsUpdate = true;

    // Помечаем атрибут цвета только если он обновлялся
    if (this.needsColorUpdate) {
      this.particles.geometry.attributes.instanceColor.needsUpdate = true;
    }
  }

  private addComponent(component: ParticleComponent): void {
    this.components.push(component);
    component.initialize();
  }

  update(currentTime: number): void {
    if (this.lastUpdateTime === 0) {
      this.lastUpdateTime = currentTime;
      return;
    }
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    // Эмиттируем частицы каждый кадр
    if (Math.random() < 1) {
      this.emit(1);
    }

    if (this.config.debug && this.debug) {
      const startTime = performance.now();
      this.updateParticles(deltaTime);
      const updateTime = performance.now() - startTime;

      this.debug.updateExecutionTime(updateTime);
      this.debug.updateParticleCount(this.activeParticles, this.config.maxParticles);
      this.debug.updatePixelCount(this.config.particle.size, this.activeParticles);
    } else {
      this.updateParticles(deltaTime);
    }
  }
}
