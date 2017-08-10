//@flow
import * as Constants from "../Constants";
import GLSL from "./GLSL";

const constantsUsingIntType = k => k.indexOf("N_") === 0;

const INJECT = Object.keys(Constants)
  .map(k => {
    const v = Constants[k];
    if (v === false) return "";
    if (v === true) return `#define ${k}`;
    if (typeof v !== "number") return "";
    if (constantsUsingIntType(k)) {
      return `#define ${k} ${Math.floor(v)}`;
    }
    return `#define ${k} ${Math.floor(v) === v ? v.toFixed(1) : v.toFixed(6)}`;
  })
  .filter(v => v)
  .join("\n");

export default (regl: *) =>
  regl({
    framebuffer: regl.prop("framebuffer"),
    frag: GLSL`
precision highp float;
// global
varying vec2 uv; // screen coordinate
uniform float time; // time in seconds
uniform sampler2D perlin; // perlin noise texture
// camera
uniform vec3 origin; // camera position
uniform mat3 rot; // camera rotation matrix
// game state
uniform sampler2D track, altTrack; // 8x1 data textures
uniform vec3 worldDelta; // accumulated distance from the first track (to generate seamless textures on walls..)
uniform float trackStepProgress; // move from 0.0 to 1.0 per step. used to interpolate all the things
uniform vec3 altTrackOffset; // delta position of the altTrack
uniform float altTrackMode; // see Constants.js
uniform float switchDirection; // position of the switch from -1.0 to 1.0
uniform float intersectionBiomeEnd; // how many step before the end of an intersection. used to place the "Rock" object.
uniform float stepIndex;

${INJECT}
#define INF 999.0

// utility functions

#define MIX_BIOMES(biomes,fn) mix(fn(biomes[0],biomes[3]),fn(biomes[1],biomes[3]),biomes[2])
#define MIX_BIOMES_2args(biomes,fn,arg1,arg2) mix(fn(arg1,arg2,biomes[0],biomes[3]),fn(arg1,arg2,biomes[1],biomes[3]),biomes[2])

float opU(float d1, float d2) {
  return min(d1,d2);
}
vec2 opU(vec2 d1, vec2 d2) {
  if (d1.x < d2.x) {
    return d1;
  }
  return d2;
}
float opUs(float k, float a, float b) {
  float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
  return mix( b, a, h ) - k*h*(1.0-h);
}
vec2 opUs(float k, vec2 d1, vec2 d2) {
  float v = opUs(k, d1.x, d2.x);
  if (d1.x < d2.x) {
    return vec2(v, d1.y);
  }
    return vec2(v, d2.y);
}
float opS(float d1, float d2) {
  return max(-d1,d2);
}
float opI(float d1, float d2) {
  return max(d1,d2);
}
void rot2 (inout vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  p = mat2(c, -s, s, c) * p;
}

// generic shapes

float sdCappedCylinder(vec3 p, vec2 h) {
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}
float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}
float udRoundBox(vec3 p, vec3 b, float r) {
  return length(max(abs(p)-b,0.0))-r;
}

// game logic

vec2 parseTrackOffset (vec4 raw) {
  float turn = TURN_DX * 2.0 * (raw[0]-0.5);
  float descent = DESCENT_DY * (raw[1]);
  return vec2(turn, descent);
}
vec4 parseTrackBiomes (vec4 raw) {
  float f = 255.0 * raw[2];
  float biome1 = floor(f / 16.0);
  float biome2 = floor(f - 16.0 * biome1);
  f = 255.0 * raw[3];
  float biomeMix = floor(f / 16.0);
  float trackSeed = floor(f - 16.0 * biomeMix);
  biomeMix /= 15.0; // [0,1] range (1 is inclusive)
  trackSeed /= 16.0; //  [0,1[ range
  return vec4(biome1, biome2, biomeMix, trackSeed);
}
float interpStepP (vec3 p) {
  return max(0.0, min(p.z, 1.0));
}
vec3 interpStep (vec3 p, vec4 prev, vec4 current) {
  float z = interpStepP(p);
  vec2 d = z * mix(parseTrackOffset(prev), parseTrackOffset(current), z); // produced curved interp, but not perfect yet.
  return p - vec3(d, 0.0);
}

// game globals, precompute more things from main() for perf.
vec4 cartTrackPrev, cartTrackCurrent;
vec3 terrainDelta;

mat3 worldNoiseS, worldNoiseM, worldNoiseL; // various size of 3D noises. each have 3 row of perlin noise (from -1.0 to 1.0) that can be multiplied by a normal vector to produce nice 3D noise.


mat3 transpose(mat3 m) {
  return mat3(m[0][0], m[1][0], m[2][0],
              m[0][1], m[1][1], m[2][1],
              m[0][2], m[1][2], m[2][2]);
}

vec3 perlin3 (vec2 uv) { // pick 3 perlin noise value of a given position
  return 2.*(texture2D(perlin, fract(uv)).rgb-.5);
}

void syncNoise (vec3 p) {
  vec3 worldP = p + terrainDelta + worldDelta;
  float nS=0.07, nM=0.03, nL=0.005;
  worldNoiseS = transpose(mat3(
    perlin3(nS * worldP.yz),
    perlin3(nS * worldP.xz),
    perlin3(nS * worldP.xy)));
  worldNoiseM = transpose(mat3(
    perlin3(nM * worldP.yz),
    perlin3(nM * worldP.xz),
    perlin3(nM * worldP.xy)));
  worldNoiseL = transpose(mat3(
    perlin3(nL * worldP.yz),
    perlin3(nL * worldP.xz),
    perlin3(nL * worldP.xy)));
}

// game shapes

const float railw = 0.3;
const vec3 railS = vec3(0.03, 0.08, 0.5);
const vec3 boardS = vec3(railw + 0.1, 0.02, 0.05);
vec2 sdRail (vec3 p) {
  float rail = opU(
    sdBox(p - vec3(railw, 0.0, 0.5), railS),
    sdBox(p - vec3(-railw, 0.0, 0.5), railS)
  );
  float board = sdBox(p, boardS);
  for (float f=0.; f<1.0; f+=0.3334) {
    board = opU(board, sdBox(p - vec3(0.0, 0.0, f), boardS));
  }
  float pylon = sdCappedCylinder(p - vec3(0.0, -1.03, 0.0), vec2(0.06, 1.0));
  return opU(opU(
    vec2(rail, 3.0),
    vec2(board, 4.0)
  ), vec2(pylon, 5.0));
}

float biomeHaveWalls (float biome, float trackSeed) {
  return biome==B_INTERS ? 0.0 : 1.0;
}

vec2 biomeRoomSize (float biome, float trackSeed) {
  vec2 sz = vec2(2.0, 2.0);
  sz += vec2(1.0 * trackSeed, 2.0 * step(0.8, trackSeed));
  if (biome == B_DARK) {
    sz += 1.0;
    sz *= vec2(1.4, 2.0);
  }
  return sz;
}

float sdSphere (vec3 p, float s) {
  return length(p)-s;
}

float sdRock (vec3 p) {
  float shape = sdSphere(p, 0.2);
  shape = opUs(0.1, shape, sdSphere(p-vec3(0.2, -0.2, 0.1), 0.3));
  shape = opUs(0.03, shape, sdSphere(p-vec3(0., -0.2, -0.1), 0.2));
  shape = opUs(0.05, shape, sdSphere(p-vec3(-0.3, -0.1, 0.1), 0.25));
  return shape;
}

/*
float sdTunnelStep (vec3 p, vec4 data) {
  float w = 2.0;
  float h = 2.0;
  return sdBox(p, vec3(w/2., h/2., 0.5));
}
// ^ this is an attempt but don't work great..
// instead will do that for now:
*/
#define WALL_WIDTH 100.0
float sdTunnelWallStep (vec3 p, vec4 data, vec4 prev) {
  vec4 biomes = parseTrackBiomes(data);
  float haveWalls = MIX_BIOMES(biomes, biomeHaveWalls);
  if (haveWalls==0.0) return INF;
  vec4 biomesPrev = parseTrackBiomes(prev);
  vec2 sizeFrom = MIX_BIOMES(biomesPrev, biomeRoomSize);
  vec2 sizeTo = MIX_BIOMES(biomes, biomeRoomSize);
  float zMix = interpStepP(p);
  vec2 size =
  vec2(mix(sizeFrom.x, sizeTo.x, zMix), sizeTo.y);
  p.y -= (size.y - 2.0) / 2.0;

  vec3 disp = vec3(0.0);

  // FIXME vary these based on biome factor...

  disp.x += 0.14 * smoothstep(0.0, 0.2, worldNoiseL[1].x);
  disp.x -= 0.08 * smoothstep(0.0, 0.4, worldNoiseM[1].x);
  disp.x -= 0.02 * smoothstep(-0.2, 0.0, worldNoiseM[0].x);
  disp.x += 0.01 * smoothstep(-0.2, 0.0, worldNoiseS[1].x);
  disp.x += 0.03 * smoothstep(-0.4, -0.3, worldNoiseS[2].x);

  disp.y += 0.1 * smoothstep(-0.4, 0.2, worldNoiseM[0].y);

  disp.z += 0.2 * mix(
    mix(smoothstep(0.5, 0.6, worldNoiseM[0].z), 0.0, 0.5 * smoothstep(-0.4, 0.6, worldNoiseL[0].z)),
    0.5 * smoothstep(0.2, -0.6, worldNoiseS[0].z),
    0.8 * smoothstep(-0.4, 0.6, worldNoiseL[2].z)
  );

  //p.x += 0.1 * sin(M_PI*2.0*p.x) * sin(M_PI*2.0*p.y) * sin(M_PI*2.0*p.z);

  // TODO interp size with Z and prev
  vec3 hs = vec3(WALL_WIDTH, size.y/2. + 2. * WALL_WIDTH, 0.5);
  vec3 ws = vec3(size.x/2. + 2. * WALL_WIDTH, WALL_WIDTH, 0.5);
  disp.z += 0.5;
  vec3 wallX = disp, wallY = disp;
  wallX.x += size.x/2. + WALL_WIDTH;
  wallY.y += size.y/2. + WALL_WIDTH;
  float left = sdBox(p-vec3(-1.0,1.0,1.0)*wallX, hs);
  float right = sdBox(p-wallX, hs);
  float up = sdBox(p-wallY, ws);
  float down = sdBox(p-vec3(0.0,-1.0,1.0)*wallY, ws);
  return opU(
    opU(up, down),
    opU(left, right)
  );
}

float biomeFireflyCount (float biome, float seed) {
  return step(B_DARK, biome) * step(biome, B_DARK) * (seed + 3.0 * seed * seed) +
  step(B_INTERS, biome) * step(biome, B_INTERS) * 1.3 * fract(2.0 * seed) +
  step(seed, 0.01);
}

vec2 sdObjectsStep (vec3 p, vec4 data, vec4 prev, float z) {
  float absZ = stepIndex - z;
  vec2 o = vec2(INF, 0.0);
  vec4 biomes = parseTrackBiomes(data);
  float firefly = MIX_BIOMES(biomes, biomeFireflyCount);
  if (firefly >= 1.0) {
    vec3 offset = vec3(
      1.0 * cos((0.8) * time + 10. * absZ),
      1.2 + sin(0.02 * (mod(absZ, 10.0)) * time + 43. * absZ),
      0.2 * cos(5.0 * time + 345. * absZ)
    );
    o = opU(o, vec2(sdSphere(p - offset, 0.04), 10.0 + 0.99 * pow(biomes[3], 2.0)));
  }
  return o;
}

vec2 sdRailTrackStep (vec3 p, vec4 data) {
  float h = 2.0;
  return sdRail(p - vec3(0.0, -h / 2.0, 0.0));
}

vec2 sdRailAltTrackStep (vec3 p, vec4 data, float i) {
  float h = 2.0;
  vec2 shape = sdRail(p - vec3(0.0, -h / 2.0, 0.0));
  vec2 lastTrackShape = vec2(max(0.0, intersectionBiomeEnd - i) + sdRock(p - vec3(0.0, -0.8, 0.9)), 8.0);
  shape = opU(shape, lastTrackShape);
  return shape;
}

const vec3 cartS = vec3(0.3, 0.23, 0.4);
const float SWITCH_H = 0.3;
const float SWITCH_SH = 0.03;
vec2 sdCartSwitch (vec3 p) {
  p.y += SWITCH_H;
  rot2(p.xy, -0.4 * switchDirection);
  p.y -= SWITCH_H;
  float stick = sdBox(p, vec3(0.01, SWITCH_H, 0.01));
  p -= vec3(0., SWITCH_H - SWITCH_SH / 2., 0.);
  float head = sdSphere(p, SWITCH_SH);
  return opU(
    vec2(head, 6.),
    vec2(stick, 7.)
  );
}

vec2 sdCartWheel(vec3 p) {
  float s = opU(
    sdSphere(p - vec3(0.03, 0.0, 0.0), 0.04),
    opS(
      sdTorus(p.yxz, vec2(0.14, 0.04)),
      opI(
        sdBox(p, vec3(0.04, 0.14, 0.14)),
        sdSphere(p, 0.14)
      )
    )
  );
  return vec2(s, 9.0);
}

const vec3 wheelOff = cartS * vec3(1.0, -1.0, 0.7) - vec3(0.0, 0.03, 0.0);
vec2 sdCart(vec3 p) {
  float w = 0.02;
  float b = 0.03;
  vec3 conv = vec3(mix(1.0, smoothstep(0.0, 2.*cartS.y, p.y), 0.3), 1.0, 1.0);
  p.y -= 0.18;
  float inside = opS(
    sdBox(p-vec3(0.0, w, 0.0), cartS*conv-vec3(w, 0.0, w)),
    sdBox(p, cartS*conv)
  );

  vec2 wheels = opU(
    opU(
      sdCartWheel(p - wheelOff),
      sdCartWheel(p - wheelOff * vec3(-1.0, 1.0, 1.0))
    ),
    opU(
      sdCartWheel(p - wheelOff * vec3(1.0, 1.0, -1.0)),
      sdCartWheel(p - wheelOff * vec3(-1.0, 1.0, -1.0))
    )
  );
  p.y -= cartS.y - b;
  vec3 hs = vec3(b, b, cartS.z);
  vec3 ws = vec3(b + cartS.x, b, b);
  float dx = cartS.x;
  float dz = cartS.z;
  float left = sdBox(p-vec3(-dx, b, 0.), hs);
  float right = sdBox(p-vec3(dx, b, 0.), hs);
  float front = sdBox(p-vec3(0., b, dz), ws);
  float back = sdBox(p-vec3(0., b, -dz), ws);
  float border = opU(
    opU(left, right),
    opU(front, back)
  );
  border = opS(sdBox(p-vec3(0., b, dz), vec3(0.6 * cartS.x, 2.0 * b, 0.5 * b)), border);
  p.z -= cartS.z;
  vec2 cartSwitch = sdCartSwitch(p);

  p += 0.5;
  vec4 s1 = texture2D(perlin, vec2(
    .5 * fract(p.x) + .5 * fract(p.z),
    .5 * fract(p.y) + .5 * fract(p.z)
  ));
  p *= 0.1;
  vec4 s2 = texture2D(perlin, vec2(
    .5 * fract(p.x) + .5 * fract(p.z),
    .5 * fract(p.y) + .5 * fract(p.z)
  ));
  float oxydation = smoothstep(0.45, 0.7, s1.x);
  oxydation *= smoothstep(0.5, 0.57, s2.z);
  float o2 = smoothstep(0.3, 0.28, s2.y);
  oxydation = mix(oxydation, o2, o2);
  return opU(opU(opU(
    vec2(inside, 2.1 + 0.9 * oxydation - 0.001),
    vec2(border, 2.0)),
    wheels),
    cartSwitch
  );
}

vec2 scene(vec3 p) {
  vec4 prev = texture2D(track, vec2(0.5/TRACK_SIZE, 0.5));
  vec4 current = texture2D(track, vec2(1.5/TRACK_SIZE, 0.5));

  // The terrain is moving in interpolated step window for the first Z unit
  p.z -= 1.0;

  vec2 m = mix(
    parseTrackOffset(cartTrackPrev),
    parseTrackOffset(cartTrackCurrent),
    trackStepProgress);

  syncNoise(p);

  vec3 terrainP = p + terrainDelta;
  vec3 altTerrainP = p + terrainDelta - altTrackOffset;
  vec3 cartP = p - vec3(0.0, -0.8, 0.3);
  rot2(cartP.xz, atan(-m.x));
  rot2(cartP.yz, atan(-m.y));

  vec2 d = opU(
    vec2(max(0.0, TRACK_SIZE - p.z), 0.0), // black wall at the end (too far to be visible)
    vec2(max(0.0, p.z + 1.0), 0.0) // black wall before (you can't see behind anyway)
  );


  // Cart
  d = opU(d, sdCart(cartP));

  // Terrain
  p = terrainP;

  // prev step
  vec3 stepP = interpStep(terrainP, prev, prev);
  vec2 rails = sdRailTrackStep(stepP, prev);
  float tunnel = sdTunnelWallStep(stepP, prev, prev);
  vec2 objects = sdObjectsStep(stepP, prev, prev, 0.0);

  // current step
  p -= vec3(parseTrackOffset(prev), 1.0);
  stepP = interpStep(p, prev, current);
  rails = opU(rails, sdRailTrackStep(stepP, current));
  tunnel = opU(tunnel, sdTunnelWallStep(stepP, current, prev));
  objects = opU(objects, sdObjectsStep(stepP, current, prev, 1.0));

  // iterate next steps
  for (float z=2.0; z<TRACK_SIZE; z++) {
    p -= vec3(parseTrackOffset(current), 1.0);
    prev = current;
    current = texture2D(track, vec2((z+0.5)/TRACK_SIZE, 0.5));
    stepP = interpStep(p, prev, current);
    rails = opU(rails, sdRailTrackStep(stepP, current));
    tunnel = opU(tunnel, sdTunnelWallStep(stepP, current, prev));
    objects = opU(objects, sdObjectsStep(stepP, current, prev, z));
  }

  if (altTrackMode != ALTT_OFF) {
    p = altTerrainP;

    vec4 prev = texture2D(altTrack, vec2(0.5/TRACK_SIZE, 0.5));
    vec4 current = texture2D(altTrack, vec2(1.5/TRACK_SIZE, 0.5));

    // prev step
    stepP = interpStep(p, prev, prev);
    rails = opU(rails, sdRailAltTrackStep(stepP, prev, 0.0));
    objects = opU(objects, sdObjectsStep(stepP, prev, prev, 0.0));

    // current step
    p -= vec3(parseTrackOffset(prev), 1.0);
    stepP = interpStep(p, prev, current);
    rails = opU(rails, sdRailAltTrackStep(stepP, current, 1.0));
    objects = opU(objects, sdObjectsStep(stepP, current, prev, 1.0));

    // iterate next steps
    for (float z=2.0; z<TRACK_SIZE; z++) {
      p -= vec3(parseTrackOffset(current), 1.0);
      prev = current;
      current = texture2D(altTrack, vec2((z+0.5)/TRACK_SIZE, 0.5));
      stepP = interpStep(p, prev, current);
      rails = opU(rails, sdRailAltTrackStep(stepP, current, z));
      objects = opU(objects, sdObjectsStep(stepP, current, prev, z));
    }
  }

  d = opU(d, vec2(tunnel, 1.0));
  d = opU(d, rails);
  d = opU(d, objects);

  return d;
}

vec3 sceneColor (float m, vec3 normal, float biome, float trackSeed) {
  if (m < 0.0) {
    return vec3(0.0);
  }
  else if (m < 1.0) {
    return vec3(0.0);
  }
  else if (m < 2.0) { // terrain
    vec3 c = vec3(0.22, 0.2, 0.18);

    // GOLD!
    float goldRarity = biome==B_GOLD ? 0.3 : 0.8; // 0.0: common, 1.0: very rare
    // TODO BIOME

    c += vec3(1.1, 0.7, 0.2) * mix(
      0.0,
      smoothstep(0.2, 0.3, dot(worldNoiseM[0], normal)),
      smoothstep(0.8*goldRarity-0.25, 0.8*goldRarity, dot(worldNoiseL[1], normal))
    );

    return c;
  }
  else if (m < 3.0) { // cart metal
    return mix(
      vec3(0.5, 0.3, 0.1),
      vec3(0.8, 0.5, 0.2),
      fract(m)
    );
  }
  else if (m < 4.0) { // rail
    return vec3(0.7);
  }
  else if (m < 5.0) { // wood
    return vec3(0.5, 0.3, 0.1);
  }
  else if (m < 6.0) { // pylon
    return vec3(0.5, 0.3, 0.0);
  }
  else if (m < 7.0) { // cart switch
    return vec3(0.6, 0., 0.);
  }
  else if (m < 8.0) { // cart switch metal
    return vec3(0.6);
  }
  else if (m < 9.0) { // rock
    return vec3(0.3);
  }
  else if (m < 10.0) { // wheel
    return vec3(0.1);
  }
  else if (m < 11.0) { // firefly
    return mix(
      vec3(0.8, 2.0, 0.8),
      vec3(0.8, 1.8, 2.0),
      fract(m)
    );
  }
  return vec3(0.0);
}

vec3 biomeAmbientColor (float b, float seed) {
  return vec3(0.2) + step(B_DARK, b) * step(b, B_DARK) * vec3(-0.5);
}

vec2 biomeFogRange (float b, float seed) {
  if (b==B_FINISH) {
    return vec2(-0.1, 0.0);
  }
  if (b==B_INTERS) {
    return vec2(0.2 * TRACK_SIZE, 0.8 * TRACK_SIZE);
  }
  return vec2(0.5 * TRACK_SIZE, TRACK_SIZE);
}

vec3 biomeFogColor (float b, float seed) {
  // nice way to "announce" some biome coming in far forward
  return vec3(
    step(B_FINISH, b) * step(b, B_FINISH) * 0.9 +
    step(B_INTERS, b) * step(b, B_INTERS) * 0.1
  );
}

vec2 raymarch(vec3 position, vec3 direction) {
  float total_distance = 0.1;
  vec2 result;
  for(int i = 0; i < N_MARCH; ++i) {
    vec3 p = position + direction * total_distance;
    result = scene(p);
    total_distance += result.x;
    if (result.x < 0.002) return vec2(total_distance, result.y);
  }
  return vec2(total_distance, result.y);
}

vec3 normal(vec3 ray_hit_position, float smoothness) {
  vec3 n;
  vec2 dn = vec2(smoothness, 0.0);
  n.x  = scene(ray_hit_position + dn.xyy).x - scene(ray_hit_position - dn.xyy).x;
  n.y  = scene(ray_hit_position + dn.yxy).x - scene(ray_hit_position - dn.yxy).x;
  n.z  = scene(ray_hit_position + dn.yyx).x - scene(ray_hit_position - dn.yyx).x;
  return normalize(n);
}

void main() {
  // Set some Global Vars..
  vec4 prev = texture2D(track, vec2(0.5/TRACK_SIZE, 0.5));
  vec4 current = texture2D(track, vec2(1.5/TRACK_SIZE, 0.5));
  terrainDelta = vec3(0.0);
  if (altTrackMode == ALTT_CART_ON) {
    cartTrackPrev = texture2D(altTrack, vec2(0.5/TRACK_SIZE, 0.5));
    cartTrackCurrent = texture2D(altTrack, vec2(1.5/TRACK_SIZE, 0.5));
    terrainDelta += altTrackOffset;
  }
  else {
    cartTrackPrev = prev;
    cartTrackCurrent = current;
  }
  terrainDelta += trackStepProgress * vec3(parseTrackOffset(cartTrackPrev), 1.0);


  // Start the scene rendering
  vec3 direction = normalize(rot * vec3(uv, 2.5));
  vec2 result = raymarch(origin, direction);
  vec3 intersection = origin + direction * result.x;
  vec3 nrml = normal(intersection, 0.02);

  float z = max(0.0, min(intersection.z + trackStepProgress - 1.0, TRACK_SIZE-1.0));
  float zIndex = floor(z);
  float zFract = z - zIndex;

  vec4 toData = texture2D(track, vec2((zIndex+0.5)/TRACK_SIZE, 0.5));
  vec4 fromData = zIndex>0.0 ? texture2D(track, vec2((zIndex-0.5)/TRACK_SIZE, 0.5)) : toData;
  vec4 fromBiomes = parseTrackBiomes(fromData);
  vec4 toBiomes = parseTrackBiomes(toData);

  vec3 materialColor = mix(
    MIX_BIOMES_2args(fromBiomes, sceneColor, result.y, nrml),
    MIX_BIOMES_2args(toBiomes, sceneColor, result.y, nrml),
    zFract
  );

  vec3 ambientColor = mix(
    MIX_BIOMES(fromBiomes, biomeAmbientColor),
    MIX_BIOMES(toBiomes, biomeAmbientColor),
    zFract
  );
  vec3 fogColor = mix(
    MIX_BIOMES(fromBiomes, biomeFogColor),
    MIX_BIOMES(toBiomes, biomeFogColor),
    zFract
  );
  vec2 fogRange = mix(
    MIX_BIOMES(fromBiomes, biomeFogRange),
    MIX_BIOMES(toBiomes, biomeFogRange),
    zFract
  );

  vec3 light_dir = normalize(vec3(0.0, 0.5, -1.0));
  float diffuse = dot(light_dir, nrml);
  diffuse = mix(diffuse, 1.0, 0.5); // half diffuse
  vec3 diffuseLit;
  vec3 lightColor = vec3(1.0);

  float fog = smoothstep(fogRange[0], fogRange[1], result.x);

  //fog=0.0;
  //diffuse += (1.0-diffuse)*0.5;

  // FIXME specular?
  diffuseLit = mix(materialColor * (diffuse * lightColor + ambientColor), fogColor, fog);

  gl_FragColor = vec4(diffuseLit, 1.0);
}
`,

    vert: GLSL`
    precision mediump float;
    attribute vec2 position;
    varying vec2 uv;
    void main() {
      gl_Position = vec4(position, 0, 1);
      uv = position;
    }`,

    attributes: {
      position: regl.buffer([[-1, -1], [-1, 4], [4, -1]])
    },

    uniforms: {
      perlin: regl.prop("perlin"),
      time: regl.prop("time"),
      rot: regl.prop("rot"),
      origin: regl.prop("origin"),
      worldDelta: regl.prop("worldDelta"),
      track: regl.prop("track"),
      trackStepProgress: regl.prop("trackStepProgress"),
      altTrack: regl.prop("altTrack"),
      altTrackOffset: regl.prop("altTrackOffset"),
      altTrackMode: regl.prop("altTrackMode"),
      switchDirection: regl.prop("switchDirection"),
      intersectionBiomeEnd: regl.prop("intersectionBiomeEnd"),
      stepIndex: regl.prop("stepIndex")
    },

    count: 3
  });
