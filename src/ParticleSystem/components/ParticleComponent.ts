import * as THREE from 'three';

import ParticleSystem from '../ParticleSystem';

export abstract class ParticleComponent {
  constructor(protected particleSystem: ParticleSystem) {}

  // Вызывается при инициализации системы
  abstract initialize(): void;

  // Вызывается при создании частицы
  abstract onEmit(index: number): void;

  // Вызывается при обновлении частицы
  abstract onUpdate(index: number, deltaTime: number, lifePercent: number): void;

  // Перемещает данные частицы при уплотнении массива
  abstract compactParticleData(targetIndex: number, sourceIndex: number): void;

  // Помечает атрибуты компонента как требующие обновления
  abstract markAttributesNeedUpdate(): void;

  // Возвращает необходимые атрибуты для шейдера
  abstract getAttributes(): Record<string, THREE.BufferAttribute>;

  // Возвращает необходимые униформы для шейдера
  abstract getUniforms(): Record<string, { value: any }>;

  // Возвращает defines для шейдера
  abstract getDefines(): Record<string, boolean>;
}