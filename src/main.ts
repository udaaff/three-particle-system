import * as THREE from 'three';
import { getAsset, initAssets, loadBundles } from "./assets/assets";
import { curve, range } from "./ParticleSystem/Range";
import ParticleSystem from "./ParticleSystem/ParticleSystem";
import { Group, PerspectiveCamera, Texture, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { ParticleSystemDebug } from './ParticleSystem/ParticleSystemDebug';
import { CurvePath, getTestPoints } from './ParticleSystem/CurvePath';

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

  const geometry = new THREE.BufferGeometry().setFromPoints(getTestPoints());
  const material = new THREE.LineBasicMaterial({
    color: 0xff0000
  });
  const curveObject = new THREE.Line(geometry, material);
  group.add(curveObject);
  // Создаем систему частиц
  const particleSystem = new ParticleSystem({
    // texture,
    maxParticles: 100000,
    renderMode: { type: 'billboard', sortParticles: true },
    // blending: THREE.AdditiveBlending,

    // Emitter configuration
    emitter: {
      type: 'point',
      position: new THREE.Vector3(0, 0, 0),
      direction: {
        vector: new THREE.Vector3(0, 1, 0),
        spread: Math.PI / 4
      },
      space: 'world'  // Используем мировые координаты
    },

    // Particle configuration
    particle: {
      lifetime: range(4, 8),
      speedScale: 4,
      size: 0.2,
      color: curve([
        [0, new THREE.Color(0, 0, 1)],
        [0.5, new THREE.Color(0, 1, 0)],
        [1, new THREE.Color(1, 0, 0)]
      ]),

      opacity: curve([
        [0, 0],
        [0.2, 1],
        [0.8, 1],
        [1, 0]
      ])
    },

    // Physics configuration
    physics: {
      velocityField: {
        path: new CurvePath(getTestPoints()),
        influence: 0.2
      },
      // gravity: new THREE.Vector3(0, -0.8, 0),
      // friction: 0.1,
      // turbulence: {
      //   strength: 0.2,
      //   scale: 1,
      //   speed: 0.5
      // }
    }
  });

  scene.add(particleSystem);

  // Добавим анимацию движения эмиттера для теста
  particleSystem.position.set(0, 0, 0);

  // Функция для движения эмиттера по кругу
  function updateEmitterPosition(time: number) {
    const radius = 5;
    const speed = 0.5;
    particleSystem.position.x = Math.cos(time * speed) * radius;
    particleSystem.position.z = Math.sin(time * speed) * radius;
  }

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  const debug = new ParticleSystemDebug();
  debug.updateComponents(particleSystem.getDebugInfo().components);

  let lastUpdateTime = 0;

  function animate(time: number) {
    requestAnimationFrame(animate);
    controls.update();

    if (lastUpdateTime === 0) {
      lastUpdateTime = time;
      return;
    }
    const deltaTime = (time - lastUpdateTime) / 1000;
    lastUpdateTime = time;

    // updateEmitterPosition(time / 1000);  // Обновляем позицию эмиттера
    particleSystem.emit(20);

    const startTime = performance.now();
    particleSystem.updateParticles(deltaTime);
    const updateTime = performance.now() - startTime;

    debug.updateExecutionTime(updateTime);
    debug.updateFps(time);
    const debugInfo = particleSystem.getDebugInfo();
    debug.updateParticleCount(debugInfo.activeParticles, debugInfo.maxParticles);

    const size = debugInfo.size;
    if (size) {
      debug.updatePixelCount(size, debugInfo.activeParticles);
    }

    renderer.render(scene, camera);
  }

  animate(0);
}

main();