import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { ParticleSystemConfig } from './ParticleSystem';

export class ParticleSystemDebug {
  private stats!: Stats;
  private particlePanel!: any;    // Количество активных частиц
  private pixelsPanel!: any;      // Нагрузка на GPU в мегапикселях
  private updateTimePanel!: any;   // Время обновления частиц в мс
  private debugPoint!: THREE.Points;

  constructor(private config: ParticleSystemConfig, private view: THREE.Object3D) {
    this.setupStats();
    this.setupDebugVisuals();
  }

  private setupStats(): void {
    this.stats = new Stats();
    this.stats.dom.style.cssText = 'position:fixed;top:0;left:100px;cursor:pointer;opacity:0.9;z-index:10000';
    document.body.appendChild(this.stats.dom);

    // Создаем три панели статистики:
    this.particlePanel = new Stats.Panel('Particles', '#ff8', '#221');     // Желтая панель
    this.pixelsPanel = new Stats.Panel('GPU Load (mp)', '#f88', '#211');   // Красная панель
    this.updateTimePanel = new Stats.Panel('Update (ms)', '#8f8', '#121'); // Зеленая панель

    this.stats.addPanel(this.particlePanel);
    this.stats.addPanel(this.pixelsPanel);
    this.stats.addPanel(this.updateTimePanel);
  }

  private setupDebugVisuals(): void {
    if (this.config.emitter.shape === 'point' && this.config.emitter.point) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',
        new THREE.Float32BufferAttribute([
          this.config.emitter.point.x,
          this.config.emitter.point.y,
          this.config.emitter.point.z
        ], 3)
      );

      const material = new THREE.PointsMaterial({
        color: 0x00ff00,
        size: 0.1,
        sizeAttenuation: true
      });

      this.debugPoint = new THREE.Points(geometry, material);
      this.view.add(this.debugPoint);
    } else if (this.config.emitter.shape === 'box' && this.config.emitter.size) {
      const boxGeometry = new THREE.BoxGeometry(
        this.config.emitter.size.x,
        this.config.emitter.size.y,
        this.config.emitter.size.z
      );
      const boxMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
      // Смещаем бокс вверх на половину высоты, так как эмиттер смещен
      boxMesh.position.y = this.config.emitter.size.y / 2;
      this.view.add(boxMesh);
    }
  }

  beginFrame(): void {
    this.stats.begin();
  }

  endFrame(): void {
    this.stats.end();
  }

  updateParticleCount(activeParticles: number, maxParticles: number): void {
    this.particlePanel.update(activeParticles, maxParticles);
  }

  updatePixelCount(size: { from: number, to: number }, activeParticles: number): void {
    const avgSize = (size.from + size.to) / 2;
    const pixelSize = avgSize * window.innerHeight;
    const pixelsPerParticle = pixelSize * pixelSize;
    const megaPixels = Math.round(pixelsPerParticle * activeParticles / 1000000);

    this.pixelsPanel.update(megaPixels, 1000);
  }

  updateExecutionTime(time: number): void {
    this.updateTimePanel.update(time, 100);
  }
}