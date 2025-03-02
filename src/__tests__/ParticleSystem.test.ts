import * as THREE from 'three';
import ParticleSystem from '../ParticleSystem/ParticleSystem';
import { range, curve } from '../ParticleSystem/Range';

describe('ParticleSystem', () => {
  describe('initialization', () => {
    it('should initialize with default config', () => {
      const system = new ParticleSystem();

      expect(system.config.maxParticles).toBe(1000);
      expect(system.activeParticles).toBe(0);
      expect(system.children.length).toBe(1); // mesh
    });

    it('should initialize with custom config', () => {
      const config = {
        maxParticles: 100,
        renderMode: { type: 'billboard' as const },
        emitter: {
          type: 'point' as const,
          position: new THREE.Vector3(1, 2, 3)
        },
        particle: {
          lifetime: range(1, 2),
          speedScale: range(0.5, 1)
        }
      };

      const system = new ParticleSystem(config);

      expect(system.config.maxParticles).toBe(100);
      expect(system.config.emitter.type).toBe('point');
      expect(system.activeParticles).toBe(0);
    });

    it('should initialize required components based on config', () => {
      const config = {
        particle: {
          lifetime: range(1, 2),
          color: new THREE.Color(1, 0, 0),
          size: range(1, 2),
          opacity: curve([[0, 0], [1, 1]]),
          speedScale: range(1, 1)
        },
        physics: {
          gravity: new THREE.Vector3(0, -9.8, 0),
          turbulence: {
            strength: 1,
            scale: 1,
            speed: 1
          }
        }
      };

      const system = new ParticleSystem(config);
      const info = system.getDebugInfo();

      expect(info.components).toContain('ColorComponent');
      expect(info.components).toContain('SizeComponent');
      expect(info.components).toContain('OpacityComponent');
      expect(info.components).toContain('GravityComponent');
      expect(info.components).toContain('TurbulenceComponent');
    });
  });

  describe('emission', () => {
    it('should emit particles and update counters', () => {
      const system = new ParticleSystem({ maxParticles: 10 });

      const emitted = system.emit(5);
      expect(emitted).toBe(5);
      expect(system.activeParticles).toBe(5);

      // Проверяем что не выходим за лимит
      const emitted2 = system.emit(10);
      expect(emitted2).toBe(5);
      expect(system.activeParticles).toBe(10);
    });

    it('should initialize particle properties on emission', () => {
      const system = new ParticleSystem({
        maxParticles: 10,
        emitter: {
          type: 'point',
          position: new THREE.Vector3(1, 2, 3),
          direction: {
            vector: new THREE.Vector3(0, 1, 0),
            spread: 0,
            randomness: 0
          }
        },
        particle: {
          lifetime: range(2, 2),
          speedScale: range(1, 1)
        }
      });

      system.emit(1);

      // Проверяем позицию
      expect(system['positions'][0]).toBe(1);
      expect(system['positions'][1]).toBe(2);
      expect(system['positions'][2]).toBe(3);

      // Проверяем скорость (должна быть направлена вверх)
      expect(system['velocities'][0]).toBeCloseTo(0, 5);
      expect(system['velocities'][1]).toBeCloseTo(1, 5);
      expect(system['velocities'][2]).toBeCloseTo(0, 5);

      // Проверяем возраст
      expect(system['ages'][0]).toBe(0);
    });
  });

  describe('update', () => {
    it('should update particle positions based on velocity', () => {
      const system = new ParticleSystem({
        maxParticles: 10,
        emitter: {
          type: 'point',
          position: new THREE.Vector3(0, 0, 0),
          direction: {
            vector: new THREE.Vector3(1, 0, 0),
            spread: 0,
            randomness: 0
          }
        },
        particle: {
          lifetime: range(2, 2),
          speedScale: range(1, 1)
        }
      });

      system.emit(1);
      system.updateParticles(1); // deltaTime = 1

      // Частица должна сдвинуться на 1 по X
      expect(system['positions'][0]).toBeCloseTo(1, 5);
      expect(system['positions'][1]).toBeCloseTo(0, 5);
      expect(system['positions'][2]).toBeCloseTo(0, 5);
    });

    it('should remove dead particles', () => {
      const system = new ParticleSystem({
        maxParticles: 10,
        particle: {
          lifetime: range(1, 1), // Фиксированное время жизни
          speedScale: range(1, 1)
        }
      });

      system.emit(2);
      expect(system.activeParticles).toBe(2);

      system.updateParticles(0.5);
      expect(system.activeParticles).toBe(2);

      system.updateParticles(0.6); // Общее время > 1, частицы должны умереть
      expect(system.activeParticles).toBe(0);
    });

    it('should compact particles when some die', () => {
      const system = new ParticleSystem({
        maxParticles: 10,
        emitter: {
          type: 'point',
          position: new THREE.Vector3(0, 0, 0)
        },
        particle: {
          lifetime: range(1.5, 1.5), // Фиксированное время жизни
          speedScale: range(0, 0)    // Нулевая скорость
        }
      });

      // Создаем 3 частицы
      system.emit(3);

      // Устанавливаем разный возраст
      system['ages'][0] = 1.5; // Эта умрет
      system['ages'][1] = 0.5; // Эта выживет
      system['ages'][2] = 1.8; // Эта умрет

      // Особые позиции для проверки
      const idx = 1 * 3;
      system['positions'][idx] = 1;     // x
      system['positions'][idx + 1] = 2; // y
      system['positions'][idx + 2] = 3; // z

      system.updateParticles(0.1);

      // Должна остаться только одна частица
      expect(system.activeParticles).toBe(1);

      // После компактификации частица должна быть в индексе 0
      expect(system['positions'][0]).toBe(1);
      expect(system['positions'][1]).toBe(2);
      expect(system['positions'][2]).toBe(3);
    });
  });
});