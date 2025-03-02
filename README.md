# Three.js Particle System

A powerful and flexible particle system for Three.js with component-based architecture.

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
  - Velocity Field (path following with adjustable influence)

- 🎯 Various emitter types:
  - Point
  - Box
  - Sphere
  - World/Local space emission for each type

- 🛣️ Path following

- 🎬 Render modes:
  - Billboard (always faces camera)
  - Velocity Aligned
  - Oriented (custom orientation):
    ```typescript
    renderMode: {
      type: 'oriented',
      normal: new THREE.Vector3(0, 1, 0), // Required: orientation vector
      up: new THREE.Vector3(0, 0, 1),     // Optional: up vector
      sortParticles: true                 // Optional: enable depth sorting
    }
    ```

## Performance

- Uses a single geometry with instanced attributes for efficient particle rendering
- Data compaction for memory optimization
- Attributes are updated only when necessary
- Components are modular and affect performance only when used:
  - Each active component adds its own update overhead
  - Unused components have zero performance impact
- Memory allocation considerations:
  - Set `maxParticles` according to actual needs as it pre-allocates memory for all attributes
  - Higher `maxParticles` values increase GPU memory usage even if fewer particles are active

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
- `VelocityFieldComponent` - path following and velocity field influence

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

## Usage

```typescript
const system = new ParticleSystem({
  // Basic setup
  texture,                    // Texture used for particles
  maxParticles: 100000,      // Maximum number of particles that can exist at once
  renderMode: {
    type: 'billboard',        // Particles always face camera
    sortParticles: true      // Enable depth-based particle sorting
  },

  // Emitter defines where and how particles spawn
  emitter: {
    type: 'box',             // Particles spawn in box shape
    size: { x: 100, y: 1, z: 100 },  // Box dimensions
    direction: {
      vector: new THREE.Vector3(0, 1, 0),  // Emit upwards
      spread: Math.PI / 4,   // 45-degree spread angle
      randomness: 0.2        // Add some randomness to direction
    },
    space: 'world'           // Emit in world coordinates
    // space: 'local'        // Or emit relative to emitter (default)
  },

  // Particle properties and behavior
  particle: {
    lifetime: range(2, 4),   // Each particle lives between 2-4 seconds
    speedScale: 1.5,         // Initial velocity multiplier (or range(1, 2) for random values)
    size: range(0.2, 0.1),  // Particle size range
    opacity: curve([         // Opacity over lifetime
      [0, 0],               // Start transparent
      [0.2, 1],             // Fade in
      [0.8, 1],             // Stay opaque
      [1, 0]                // Fade out at end
    ]),
    // Optional: color, textureRotation, geometryRotation
  },

  // Optional physics simulation
  physics: {
    gravity: new THREE.Vector3(0, 0.8, 0),  // Upward force
    friction: 0.1,                          // Slow down over time
    turbulence: {                           // Add random motion
      strength: 0.2,                        // How much it affects particles
      scale: 1,                             // Size of turbulence pattern
      speed: 0.5                            // How fast pattern changes
    },
    velocityField: {                        // Guide particles along a path
      path: curvePath,                      // Path to follow
      influence: 0.3                        // How strongly particles follow the path (0-1)
    }
  }
});

function animate(deltaTime: number) {
  // Create new particles each frame
  system.emit(1000);  // Emit 1000 particles

  // Update particle simulation
  system.updateParticles(deltaTime);
}
```

## License

MIT License. See LICENSE file for details.