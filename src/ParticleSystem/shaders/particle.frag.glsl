precision highp float;

uniform sampler2D uTexture;

varying vec2 vUv;
#ifdef USE_OPACITY
varying float vOpacity;
#endif
varying vec3 vColor;

void main() {
  vec4 texColor = texture2D(uTexture, vUv);
  vec3 tint = vColor.r < 0.0 ? vec3(1.0) : (vec3(1.0) + vColor);
  vec3 color = texColor.rgb * tint;
  #ifdef USE_OPACITY
  gl_FragColor = vec4(color, texColor.a * vOpacity);
  #else
  gl_FragColor = vec4(color, texColor.a);
  #endif
}