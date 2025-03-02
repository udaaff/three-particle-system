precision highp float;

uniform sampler2D uTexture;

varying vec2 vUv;
#ifdef USE_OPACITY
varying float vOpacity;
#endif
varying vec3 vColor;

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 color = texColor.rgb * vColor; // Корректное применение tint
  #ifdef USE_OPACITY
  gl_FragColor = vec4(color, texColor.a * vOpacity);
  #else
  gl_FragColor = vec4(color, texColor.a);
  #endif
}
