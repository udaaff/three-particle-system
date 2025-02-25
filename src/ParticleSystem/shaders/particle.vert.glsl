precision highp float;

// Встроенные атрибуты THREE.js
attribute vec3 position;
attribute vec2 uv;

// Встроенные униформы THREE.js
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;

// Наши кастомные атрибуты
attribute vec3 instancePosition;
attribute float instanceScale;
attribute float instanceOpacity;
attribute vec3 instanceColor;
attribute float instanceRotation;

varying vec2 vUv;
varying float vOpacity;
varying vec3 vColor;

#ifdef USE_TURBULENCE
// Униформы и функции для турбулентности
uniform float uTime;
uniform float uTurbulenceStrength;
uniform float uTurbulenceScale;
uniform float uTurbulenceSpeed;

// Функция хэширования для псевдослучайных чисел
vec3 hash33(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p.zxy, p.yxz + 19.19);
  return fract(vec3(p.x * p.y, p.z * p.x, p.y * p.z));
}

// Функция шума Перлина
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  vec3 h000 = hash33(i);
  vec3 h100 = hash33(i + vec3(1.0, 0.0, 0.0));
  vec3 h010 = hash33(i + vec3(0.0, 1.0, 0.0));
  vec3 h110 = hash33(i + vec3(1.0, 1.0, 0.0));
  vec3 h001 = hash33(i + vec3(0.0, 0.0, 1.0));
  vec3 h101 = hash33(i + vec3(1.0, 0.0, 1.0));
  vec3 h011 = hash33(i + vec3(0.0, 1.0, 1.0));
  vec3 h111 = hash33(i + vec3(1.0, 1.0, 1.0));

  return mix(
    mix(
      mix(dot(h000, f - vec3(0.0, 0.0, 0.0)), dot(h100, f - vec3(1.0, 0.0, 0.0)), f.x),
      mix(dot(h010, f - vec3(0.0, 1.0, 0.0)), dot(h110, f - vec3(1.0, 1.0, 0.0)), f.x),
      f.y
    ),
    mix(
      mix(dot(h001, f - vec3(0.0, 0.0, 1.0)), dot(h101, f - vec3(1.0, 0.0, 1.0)), f.x),
      mix(dot(h011, f - vec3(0.0, 1.0, 1.0)), dot(h111, f - vec3(1.0, 1.0, 1.0)), f.x),
      f.y
    ),
    f.z
  );
}

// Функция турбулентности (сложение нескольких октав шума)
vec3 turbulence(vec3 p) {
  vec3 turbulence = vec3(0.0);
  float amplitude = 1.0;
  float frequency = 1.0;

  for(int i = 0; i < 4; i++) {
    turbulence += vec3(
      noise(p * frequency + vec3(0.0, 0.0, uTime * uTurbulenceSpeed)),
      noise(p * frequency + vec3(1.234, 5.678, uTime * uTurbulenceSpeed)),
      noise(p * frequency + vec3(9.876, 4.321, uTime * uTurbulenceSpeed))
    ) * amplitude;

    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return turbulence;
}
#endif

void main() {
  vec2 rotatedUV = uv - 0.5;
  float c = cos(instanceRotation);
  float s = sin(instanceRotation);
  rotatedUV = vec2(
    rotatedUV.x * c - rotatedUV.y * s,
    rotatedUV.x * s + rotatedUV.y * c
  );
  vUv = rotatedUV + 0.5;

  vOpacity = instanceOpacity;
  vColor = instanceColor;

  vec3 finalPosition = instancePosition;

  #ifdef USE_TURBULENCE
    // Применяем турбулентность к позиции
    vec3 turbulentOffset = turbulence(instancePosition * uTurbulenceScale) * uTurbulenceStrength;
    finalPosition += turbulentOffset;
  #endif

  #ifdef BILLBOARD
    vec3 cameraRight = vec3(viewMatrix[0].x, viewMatrix[1].x, viewMatrix[2].x);
    vec3 cameraUp = vec3(viewMatrix[0].y, viewMatrix[1].y, viewMatrix[2].y);

    vec3 vertexPosition =
      cameraRight * position.x * instanceScale +
      cameraUp * position.y * instanceScale;

    vertexPosition += finalPosition;
  #else
    #if defined(PLANE_XZ)
      vec3 vertexPosition = vec3(
        position.x * instanceScale,
        0.0,
        position.y * instanceScale
      );
      vertexPosition = vec3(
        vertexPosition.x * c + vertexPosition.z * s,
        vertexPosition.y,
        -vertexPosition.x * s + vertexPosition.z * c
      );
    #elif defined(PLANE_XY)
      vec3 vertexPosition = vec3(
        position.x * instanceScale,
        position.y * instanceScale,
        0.0
      );
      vertexPosition = vec3(
        vertexPosition.x * c - vertexPosition.y * s,
        vertexPosition.x * s + vertexPosition.y * c,
        vertexPosition.z
      );
    #else // PLANE_YZ
      vec3 vertexPosition = vec3(
        0.0,
        position.x * instanceScale,
        position.y * instanceScale
      );
      vertexPosition = vec3(
        vertexPosition.x,
        vertexPosition.y * c - vertexPosition.z * s,
        vertexPosition.y * s + vertexPosition.z * c
      );
    #endif

    vertexPosition += finalPosition;
  #endif

  vec4 mvPosition = modelViewMatrix * vec4(vertexPosition, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}