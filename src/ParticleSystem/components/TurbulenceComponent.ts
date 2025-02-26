import * as THREE from 'three';
import { ParticleComponent } from './ParticleComponent';
import ParticleSystem, { ParticleSystemConfig } from '../ParticleSystem';

type TurbulenceConfig = {
  strength: number;
  scale: number;
  speed: number;
};

export class TurbulenceComponent extends ParticleComponent {
  private time: number = 0;
  private config: TurbulenceConfig;

  static override getConfigValue(config: ParticleSystemConfig): TurbulenceConfig | undefined {
    return config.physics?.turbulence;
  }

  constructor(system: ParticleSystem) {
    super(system);
    const config = TurbulenceComponent.getConfigValue(system.config);
    if (!config) throw new Error('Turbulence config is required for TurbulenceComponent');
    this.config = config;
  }

  initialize(): void {
    // Инициализация не требуется
  }

  onEmit(_index: number): void {
    // Для турбулентности не нужно ничего делать при эмиссии
  }

  onUpdate(_index: number, deltaTime: number): void {
    this.time += deltaTime;
  }

  compactParticleData(_targetIndex: number, _sourceIndex: number): void {}

  markAttributesNeedUpdate(): void {}

  getAttributes(): Record<string, THREE.BufferAttribute> {
    return {};
  }

  getUniforms(): Record<string, { value: any }> {
    return {
      uTime: { value: this.time },
      uTurbulenceStrength: { value: this.config.strength },
      uTurbulenceScale: { value: this.config.scale },
      uTurbulenceSpeed: { value: this.config.speed }
    };
  }

  getDefines(): Record<string, boolean> {
    return {
      USE_TURBULENCE: true
    };
  }
}