uniform vec3 uHandA;
uniform vec3 uHandB;
uniform float uHandCount;
uniform float uSculptStrength;

vec3 treDeform(vec3 position, vec3 normal) {
  float influenceA = 1.0 - smoothstep(0.0, 0.9, distance(position, uHandA));
  float influenceB = 1.0 - smoothstep(0.0, 0.9, distance(position, uHandB));
  float influence = max(influenceA, influenceB * step(1.5, uHandCount));
  float ripple = sin(position.y * 8.0 + position.x * 5.0) * 0.045;
  return position + normal * (influence * (0.28 + ripple) * uSculptStrength);
}
