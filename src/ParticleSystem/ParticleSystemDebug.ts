import { Curve, Range } from "./Range";

export class ParticleSystemDebug {
  private particleCountElement: HTMLDivElement;
  private pixelCountElement: HTMLDivElement;
  private executionTimeElement: HTMLDivElement;
  private fpsElement: HTMLDivElement;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private lastDebugUpdate: number = 0;
  private updateInterval: number = 500; // Обновляем каждые 500мс

  // Значения для сглаживания
  private smoothedExecutionTime: number = 0;
  private smoothedParticleCount: number = 0;
  private smoothedPixelCount: number = 0;
  private smoothingFactor: number = 0.1; // Фактор сглаживания (0-1)

  constructor() {
    // Создаем элементы для отображения дебаг информации
    const debugContainer = document.createElement('div');
    debugContainer.style.position = 'fixed';
    debugContainer.style.top = '10px';
    debugContainer.style.left = '10px';
    debugContainer.style.color = 'white';
    debugContainer.style.fontFamily = 'monospace';
    debugContainer.style.zIndex = '1000';

    this.particleCountElement = document.createElement('div');
    this.pixelCountElement = document.createElement('div');
    this.executionTimeElement = document.createElement('div');
    this.fpsElement = document.createElement('div');

    debugContainer.appendChild(this.fpsElement);
    debugContainer.appendChild(this.particleCountElement);
    debugContainer.appendChild(this.pixelCountElement);
    debugContainer.appendChild(this.executionTimeElement);

    document.body.appendChild(debugContainer);
  }

  private smooth(current: number, target: number): number {
    return current + this.smoothingFactor * (target - current);
  }

  private updateDebugValues() {
    const currentTime = performance.now();
    if (currentTime > this.lastDebugUpdate + this.updateInterval) {
      this.particleCountElement.textContent =
        `Particles: ${Math.round(this.smoothedParticleCount)}/${this.maxParticles}`;
      this.pixelCountElement.textContent =
        `Estimated pixels: ${Math.round(this.smoothedPixelCount)}`;
      this.executionTimeElement.textContent =
        `Update time: ${this.smoothedExecutionTime.toFixed(2)}ms`;
      this.lastDebugUpdate = currentTime;
    }
  }

  updateFps(currentTime: number) {
    this.frameCount++;

    // Обновляем FPS каждую секунду
    if (currentTime > this.lastFpsUpdate + 1000) {
      const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
      this.fpsElement.textContent = `FPS: ${fps}`;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }
  }

  private maxParticles: number = 0;

  updateParticleCount(active: number, max: number) {
    this.maxParticles = max;
    this.smoothedParticleCount = this.smooth(this.smoothedParticleCount, active);
    this.updateDebugValues();
  }

  updatePixelCount(size: number | Range | Curve, activeParticles: number) {
    let avgSize: number;
    if (typeof size === 'number') {
      avgSize = size;
    } else if (size instanceof Range) {
      avgSize = (size.from + size.to) / 2;
    } else {
      avgSize = size.lerp(0.5);
    }
    const pixelCount = Math.round(avgSize * avgSize * Math.PI * activeParticles);
    this.smoothedPixelCount = this.smooth(this.smoothedPixelCount, pixelCount);
    this.updateDebugValues();
  }

  updateExecutionTime(time: number) {
    this.smoothedExecutionTime = this.smooth(this.smoothedExecutionTime, time);
    this.updateDebugValues();
  }
}