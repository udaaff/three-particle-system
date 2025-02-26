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
import { PositioningComponent } from './components/PositioningComponent';

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
  public activeParticles!: number;
  private components: ParticleComponent[] = [];
  private ages!: Float32Array;
  private positioningComponent!: PositioningComponent;

  private static readonly componentTypes = [
    TurbulenceComponent,
    GravityComponent,
    FrictionComponent,
    TextureRotationComponent,
    GeometryRotationComponent,
    ColorComponent,
    OpacityComponent,
    SizeComponent
  ] as const;

  constructor(config: Partial<ParticleSystemConfig> = {}) {
    super();
    this.config = this.getDefaultConfig(config);

    // Сначала инициализируем PositioningComponent, так как он обязателен
    // this.positioningComponent = new PositioningComponent(this);
    // this.addComponent(this.positioningComponent);

    // Затем инициализируем остальные компоненты на основе конфига
    for (const ComponentType of ParticleSystem.componentTypes) {
      if (ComponentType.getConfigValue(this.config)) {
        this.addComponent(new ComponentType(this));
      }
    }

    this.setupParticleSystem();
  }

  getDefaultConfig(config?: Partial<ParticleSystemConfig>): ParticleSystemConfig {
    return {
      texture: new THREE.Texture(),
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
        speedScale: range(0, 0.2),
        textureRotation: range(-0.04, 0.04),
        geometryRotation: range(-0.04, 0.04),
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

    this.ages = new Float32Array(this.config.maxParticles);

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

  emit(count: number): number {
    const startIndex = this.activeParticles;
    const endIndex = Math.min(startIndex + count, this.config.maxParticles);
    const actualCount = endIndex - startIndex;

    for (let i = 0; i < actualCount; i++) {
      const index = startIndex + i;
      this.ages[index] = 0;

      // Вызываем onEmit для каждого компонента
      for (const component of this.components) {
        component.onEmit(index);
      }
    }

    this.activeParticles = endIndex;

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
      const lifePercent = this.ages[i] / this.config.particle.lifetime.to;

      if (this.ages[i] < this.config.particle.lifetime.to) {
        if (currentIndex !== i) {
          // Копируем данные из компонентов
          for (const component of this.components) {
            component.compactParticleData(currentIndex, i);
          }
          this.ages[currentIndex] = this.ages[i];
        }

        // Обновляем каждый компонент
        for (const component of this.components) {
          component.onUpdate(currentIndex, deltaTime, lifePercent);
        }

        currentIndex++;
      }
    }

    this.activeParticles = currentIndex;
    this.particles.count = currentIndex;

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

  getComponent<T extends ParticleComponent>(componentType: { new (...args: any[]): T }): T | undefined {
    // Проверяем, является ли запрашиваемый компонент PositioningComponent
    if (this.positioningComponent instanceof componentType) {
      return this.positioningComponent;
    }
    return this.components.find(c => c instanceof componentType) as T | undefined;
  }
}
