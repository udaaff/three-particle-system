import * as THREE from 'three';
import { getAsset, initAssets, loadBundles } from "./assets/assets";
import { range, curve } from "./ParticleSystem/Range";
import ParticleSystem from "./ParticleSystem/ParticleSystem";
import { Group, PerspectiveCamera, Texture, Vector3, WebGLRenderer } from "three";

document.addEventListener("DOMContentLoaded", async () => {
  await main();
});

async function main() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xFFFFFF);
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 15);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  await initAssets({
    manifestPath: "assets-manifest.json",
    basePath: "assets"
  });
  await loadBundles("common");

  const texture = getAsset<Texture>("three-js-icon.png");
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
    maxParticles: 100,
    debug: true,
    renderMode: {
      type: 'billboard'
    },
    emitter: {
      shape: 'point'
    },
    particle: {
      color: new THREE.Color(1, 0, 0),
      lifetime: range(1, 3),
      size: range(1, 3),
      opacity:  curve([
        [0, 0],
        [0.2, 0.2],
        [0.8, 0.2 ],
        [1, 0]
      ]),
      speedScale: range(1, 2),
      rotation: range(-2, 2)
    },
    _physics: {
      gravity: new Vector3(0, 0, 0),
      friction: 0,
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
    // group.rotateY(0.001);
    // for (const cube of group.children) {
    //   cube.rotateZ(0.002);
    // }
    particleSystem.update(time);
    renderer.render(scene, camera);
  }

  animate(0);
}