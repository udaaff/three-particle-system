import * as THREE from 'three';
import { getAsset, initAssets, loadBundles } from "./assets/assets";
import { range, curve } from "./ParticleSystem/Range";
import ParticleSystem from "./ParticleSystem/ParticleSystem";
import { Group, PerspectiveCamera, Texture, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from 'three/examples/jsm/Addons.js';

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

  // Создаем систему частиц
  const particleSystem = new ParticleSystem({
    texture: texture,
    maxParticles: 1000,
    blending: THREE.AdditiveBlending,
    debug: true,
    renderMode: {
      type: 'billboard',
    },
    emitter: {
      type: 'point',
      position: new Vector3(0, 1, 0),
      direction: {
        vector: new Vector3(0, 1, 0),  // Направление вверх
        spread: Math.PI / 4,           // Угол разброса 45 градусов
        randomness: 0.3                // Небольшая случайность для естественности
      }
    },
    particle: {
      lifetime: range(1, 2),
      size: range(2.0, 2.0),
      color: new THREE.Color(1, 0, 0),
      opacity: curve([
        [0, 1],
        [0.8, 1],
        [1, 0]
      ]),
      speedScale: range(1, 2),
      textureRotation: range(-Math.PI, Math.PI),
      geometryRotation: range(-Math.PI / 4, Math.PI / 4)
    },
    _physics: {
      gravity: new Vector3(0, 0, 0),
      friction: 0.0,
      vortex: {
        strength: 0,
        center: new Vector3(0, 0, 0)
      }
    }
  });

  scene.add(particleSystem);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  function animate(time: number) {
    requestAnimationFrame(animate);
    controls.update(); // Обновляем контролы
    particleSystem.update(time);
    renderer.render(scene, camera);
  }

  animate(0);
}