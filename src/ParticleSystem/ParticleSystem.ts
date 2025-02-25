import * as THREE from 'three';
import { Blending } from 'three';

import { ParticleComponent } from './components/ParticleComponent';
import { TurbulenceComponent } from './components/TurbulenceComponent';
import { CurvePath } from './CurvePath';
import { ParticleSystemDebug } from './ParticleSystemDebug';
import { ColorCurve, ColorRange, Curve, curve, Range, range } from './Range';
import vertexShader from './shaders/particle.vert.glsl';
import fragmentShader from './shaders/particle.frag.glsl';

export interface ParticleSystemConfig {
  texture: THREE.Texture;
  maxParticles: number;
  blending?: Blending;
  debug: boolean;
  renderMode: {
    type: 'billboard' | 'plane';
    plane?: {
      normal: 'xz' | 'xy' | 'yz';  // в какой плоскости рисовать
    };
  };
  emitter: {
    shape: 'box' | 'sphere' | 'point';
    size?: {
      x: number;
      y: number;
      z: number;
    };
    point?: THREE.Vector3;
  };
  particle: {
    lifetime: Range;
    color?: THREE.Color | ColorRange | ColorCurve;
    size: Range;
    opacity: Range | Curve;
    speedScale: Range;
    rotation: Range;  // Скорость вращения в радианах/сек
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
  private particlePanel: any;    // Количество активных частиц
  private pixelsPanel: any;      // Нагрузка на GPU в мегапикселях
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
  private rotations!: Float32Array;      // Храним только скорость вращения
  private rotationSpeeds!: Float32Array; // Скорость вращения
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

    this.setupParticleSystem();
  }

  getDefaultConfig(config?: Partial<ParticleSystemConfig>): ParticleSystemConfig {
    return {
      texture: new THREE.Texture(), // Нужно установить текстуру при создании
      maxParticles: 50000,
      debug: true,
      renderMode: {
        type: 'plane' as const,
        plane: {
          normal: 'xz' as const
        }
      },
      emitter: {
        shape: 'box' as const,
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
        rotation: range(-0.04, 0.04),
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
    this.rotations = new Float32Array(this.config.maxParticles);
    this.rotationSpeeds = new Float32Array(this.config.maxParticles);

    instancedGeometry.setAttribute('instancePosition',
      new THREE.InstancedBufferAttribute(this.positions, 3));
    instancedGeometry.setAttribute('instanceScale',
      new THREE.InstancedBufferAttribute(this.scales, 1));
    instancedGeometry.setAttribute('instanceOpacity',
      new THREE.InstancedBufferAttribute(this.opacities, 1));
    instancedGeometry.setAttribute('instanceColor',
      new THREE.InstancedBufferAttribute(this.colors, 3));
    instancedGeometry.setAttribute('instanceRotation',
      new THREE.InstancedBufferAttribute(this.rotations, 1));

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
    const isBillboard = this.config.renderMode.type === 'billboard';
    const planeNormal = this.config.renderMode.plane?.normal || 'xz';

    const defines: { [key: string]: boolean } = {};
    if (isBillboard) {
      defines.BILLBOARD = true;
    } else {
      defines[`PLANE_${planeNormal.toUpperCase()}`] = true;
    }

    // Добавляем defines от компонентов
    for (const component of this.components) {
      Object.assign(defines, component.getDefines());
    }

    // Собираем униформы от всех компонентов
    const uniforms: Record<string, { value: any }> = {
      uTexture: { value: texture }
    };
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

    switch (this.config.emitter.shape) {
      case 'box': {
        if (!this.config.emitter.size) {
          throw new Error('Box emitter requires size configuration');
        }
        // Случайная позиция внутри бокса
        position.set(
          (Math.random() - 0.5) * this.config.emitter.size.x,
          (Math.random() - 0.5) * this.config.emitter.size.y + this.config.emitter.size.y / 2,
          (Math.random() - 0.5) * this.config.emitter.size.z
        );

        direction.randomDirection();
        break;
      }
      case 'point':
      default: {
        position.copy(this.config.emitter.point || new THREE.Vector3());
        direction.randomDirection();
        break;
      }
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
      this.velocities[index * 3] = direction.x;
      this.velocities[index * 3 + 1] = direction.y;
      this.velocities[index * 3 + 2] = direction.z;

      this.scales[index] = this.config.particle.size.lerp(0);
      this.opacities[index] = this.config.particle.opacity.lerp(0);
      this.ages[index] = 0;

      // Сохраняем случайную скорость вращения
      this.rotations[index] = 0;
      this.rotationSpeeds[index] = this.config.particle.rotation.lerp(Math.random()); // Скорость вращения

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

          this.scales[currentIndex] = this.scales[i];
          this.opacities[currentIndex] = this.opacities[i];
          this.ages[currentIndex] = this.ages[i];
          this.speedMultipliers[currentIndex] = this.speedMultipliers[i];
          this.rotations[currentIndex] = this.rotations[i];
          this.rotationSpeeds[currentIndex] = this.rotationSpeeds[i];

          // Копируем цвета покомпонентно
          this.colors[currentIndex * 3] = this.colors[i * 3];
          this.colors[currentIndex * 3 + 1] = this.colors[i * 3 + 1];
          this.colors[currentIndex * 3 + 2] = this.colors[i * 3 + 2];
        }

        const lifePercent = this.ages[currentIndex] / this.config.particle.lifetime.to;

        // Обновляем каждый компонент
        for (const component of this.components) {
          component.onUpdate(currentIndex, deltaTime, lifePercent);
        }

        // Обновляем угол поворота используя скорость
        this.rotations[currentIndex] += this.rotationSpeeds[currentIndex] * deltaTime;

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

    if (this.config.debug && this.particlePanel) {
      this.particlePanel.updateParticleCount(this.activeParticles, this.config.maxParticles);
      const size = this.config.particle.size;
      this.pixelsPanel.updatePixelCount(size, this.activeParticles);
    }

    this.particles.geometry.attributes.instancePosition.needsUpdate = true;
    this.particles.geometry.attributes.instanceScale.needsUpdate = true;
    this.particles.geometry.attributes.instanceOpacity.needsUpdate = true;
    this.particles.geometry.attributes.instanceColor.needsUpdate = true;
    this.particles.geometry.attributes.instanceRotation.needsUpdate = true;

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
    this.emit(10);

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