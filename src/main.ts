import * as THREE from 'three';
import { getAsset, initAssets, loadBundles } from "./assets/assets";
import { range, curve } from "./ParticleSystem/Range";
import ParticleSystem from "./ParticleSystem/ParticleSystem";
import { Group, PerspectiveCamera, Texture, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { ParticleSystemDebug } from './ParticleSystem/ParticleSystemDebug';

document.addEventListener("DOMContentLoaded", async () => {
  await main();
});

async function main() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 15);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);
  document.body.appendChild(renderer.domElement);

  // Добавляем OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  await initAssets({
    manifestPath: "assets-manifest.json",
    basePath: "assets"
  });
  await loadBundles("common");

  const texture = getAsset<Texture>("flame.png");
  if (!texture) {
    console.error('Failed to load texture');
    return;
  }
  console.log('Texture loaded:', texture.image !== undefined);

  const group = new Group();
  scene.add(group);

  // Создаем дебаг до создания ParticleSystem
  const debug = new ParticleSystemDebug();

  // Создаем систему частиц
  const particleSystem = new ParticleSystem({
    texture: texture,
    maxParticles: 2000,
    blending: THREE.AdditiveBlending,
    renderMode: {
      type: 'billboard',
    },
    emitter: {
      type: 'point',
      position: new Vector3(0, 1, 0),
      direction: {
        vector: new Vector3(0, 1, 0),  // Направление вверх
        spread: Math.PI / 2,           // Угол разброса 45 градусов
        randomness: 0.3                // Небольшая случайность для естественности
      }
    },
    particle: {
      lifetime: range(5, 10),
      size: range(0.1, 0.2),
      color: curve([
        [0, new THREE.Color(1, 0, 0)],     // Красный в начале
        [0.5, new THREE.Color(0, 1, 0)],    // Желтый в середине
        [1, new THREE.Color(0, 0, 1)]       // Белый в конце
      ]),
      opacity: curve([
        [0, 0],
        [0.2, 1],
        [0.8, 1],
        [1, 0]
      ]),
      speedScale: range(2, 3),
      textureRotation: range(-Math.PI, Math.PI)
    },
    physics: {
      gravity: new Vector3(0, -0.6, 0),
      friction: 0.5,
      turbulence: {
        strength: 0.4,
        scale: 0.2,
        speed: 0.2
      }
    }
  });

  scene.add(particleSystem);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  let lastUpdateTime = 0;

  function updateDebugInfo(particleSystem: ParticleSystem) {
    const debugInfo = particleSystem.getDebugInfo();
    debug.updateParticleCount(debugInfo.activeParticles, debugInfo.maxParticles);

    const size = debugInfo.size;
    if (size) {
      debug.updatePixelCount(size, debugInfo.activeParticles);
    }
  }

  function animate(time: number) {
    requestAnimationFrame(animate);
    controls.update();

    if (lastUpdateTime === 0) {
      lastUpdateTime = time;
      return;
    }
    const deltaTime = (time - lastUpdateTime) / 1000;
    lastUpdateTime = time;

    if (Math.random() < 0.1) {
      particleSystem.emit(100);
    }

    const startTime = performance.now();
    particleSystem.updateParticles(deltaTime);
    const updateTime = performance.now() - startTime;

    debug.updateExecutionTime(updateTime);
    debug.updateFps(time);
    updateDebugInfo(particleSystem);

    renderer.render(scene, camera);
  }

  animate(0);
}