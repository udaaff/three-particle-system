# Three.js Particle System

A powerful and flexible particle system for Three.js with component-based architecture.

## Requirements

- Three.js r150 or higher
- TypeScript 4.x
- Modern browser with WebGL 2.0 support

## Features

- 🎨 Customizable particle properties:
  - Color (static, gradient, or curve)
  - Size (static, range, or curve)
  - Opacity (static, range, or curve)
  - Lifetime
  - Speed
  - Texture rotation
  - Geometry rotation

- 🌈 Physics effects:
  - Gravity
  - Friction
  - Turbulence

- 🎯 Various emitter types:
  - Point
  - Box
  - Sphere

- 🛣️ Path following

- 🎬 Render modes:
  - Billboard (always faces camera)
  - Velocity Aligned
  - Oriented (custom orientation)

## Usage

```typescript
import * as THREE from 'three';
import ParticleSystem from './ParticleSystem';
import { range, curve } from './Range';

// Setup Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera.position.z = 100;

async function createParticleSystem() {
  // Create particle texture
  const texture = await new THREE.TextureLoader().loadAsync('particle.png');

  // Configure particle system
  const system = new ParticleSystem({
    texture,
    maxParticles: 100000,
    renderMode: { type: 'billboard' },

    // Emitter configuration
    emitter: {
      type: 'box',
      size: { x: 100, y: 1, z: 100 },
      direction: {
        vector: new THREE.Vector3(0, 1, 0),
        spread: Math.PI / 4
      }
    },

    // Particle configuration
    particle: {
      lifetime: range(2, 4),
      speedScale: range(1, 2),
      size: range(0.2, 0.1),
      opacity: curve([
        [0, 0],
        [0.2, 1],
        [0.8, 1],
        [1, 0]
      ])
    },

    // Physics configuration
    physics: {
      gravity: new THREE.Vector3(0, 0.8, 0),
      friction: 0.1,
      turbulence: {
        strength: 0.2,
        scale: 1,
        speed: 0.5
      }
    }
  });

  // Add to scene
  scene.add(system);

  return system;
}

// Initialize the system
let particleSystem: ParticleSystem;
createParticleSystem().then(system => {
  particleSystem = system;
});

// Animation loop setup
let lastTime = 0;
function animate(currentTime: number) {
  const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  if (particleSystem) {
    particleSystem.emit(1000); // create 1000 particles per frame
    particleSystem.updateParticles(deltaTime);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// Start animation loop
requestAnimationFrame(animate);

// Handle window resize
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});
```

## Component Architecture

The system is built on components, each responsible for a specific aspect of particle behavior:

- `ColorComponent` - particle colors
- `SizeComponent` - particle sizes
- `OpacityComponent` - transparency
- `TextureRotationComponent` - texture rotation
- `GeometryRotationComponent` - geometry rotation
- `GravityComponent` - gravity effect
- `FrictionComponent` - friction effect
- `TurbulenceComponent` - turbulence effect

Components are automatically added when corresponding parameters are specified in the configuration.

## Debugging

The system includes an optional debug overlay that displays real-time performance metrics and system state. The debug panel is rendered as a semi-transparent overlay on top of your scene.

```typescript
import { ParticleSystemDebug } from './ParticleSystemDebug';

const debug = new ParticleSystemDebug(system);

function animate(deltaTime: number) {
  debug.update(deltaTime);
}
```

Displays information about:
- Active particle count and maximum capacity
- Real-time FPS with smoothing
- System update time in milliseconds
- List of active components
- Estimated pixel fill rate

The debug overlay can be helpful during development and performance optimization.

## Performance

- Uses a single geometry with instanced attributes for efficient particle rendering
- Data compaction for memory optimization
- Attributes are updated only when necessary
- Components are modular and affect performance only when used:
  - Each active component adds its own update overhead
  - Unused components have zero performance impact
  - Most expensive components are Turbulence and Path following

## License

MIT License. See LICENSE file for details.