//@flow
import * as Constants from "../Constants";
import GLSL from "./GLSL";
import qualityResolver from "../qualityResolver";

type Quality = "low" | "medium" | "high";

const constantsUsingIntType = k => k.indexOf("N_") === 0;
const constantsProvideIntVersion = k => k === "TRACK_SIZE";

const injectDefine = (quality: Quality, k: string, v: mixed): string => {
  if (typeof v === "function") {
    v = v(quality);
  }
  if (v === false) return "";
  if (v === true) return `#define ${k}`;
  if (typeof v !== "number") return "";
  if (constantsUsingIntType(k)) {
    return `#define ${k} ${Math.floor(v)}`;
  }
  let s = `#define ${k} ${Math.floor(v) === v ? v.toFixed(1) : v.toFixed(6)}`;
  if (constantsProvideIntVersion(k)) {
    s += `\n#define ${k}_INT ${Math.floor(v)}`;
  }
  return s;
};

const injectDefines = (quality: Quality) =>
  Object.keys(Constants)
    .map(k => injectDefine(quality, k, Constants[k]))
    .filter(v => v)
    .join("\n");

const normalFunction = qualityResolver({
  low: GLSL`\
vec3 normal(vec3 ray_hit_position, float smoothness) {
  return vec3(0.0, 1.0, 0.0);
}
`,
  default: GLSL`\
vec3 normal(vec3 ray_hit_position, float smoothness) {
  vec3 n;
  vec2 dn = vec2(smoothness, 0.0);
  n.x  = scene(ray_hit_position + dn.xyy).x - scene(ray_hit_position - dn.xyy).x;
  n.y  = scene(ray_hit_position + dn.yxy).x - scene(ray_hit_position - dn.yxy).x;
  n.z  = scene(ray_hit_position + dn.yyx).x - scene(ray_hit_position - dn.yyx).x;
  return normalize(n);
}`
});

export default (regl: *, quality: Quality) =>
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
uniform vec3 terrainOffset;
uniform vec3 worldDelta; // accumulated distance from the first track (to generate seamless textures on walls..)
uniform float trackStepProgress; // move from 0.0 to 1.0 per step. used to interpolate all the things
uniform vec3 altTrackOffset; // delta position of the altTrack
uniform float altTrackMode; // see Constants.js
uniform float switchDirection; // position of the switch from -1.0 to 1.0
uniform float intersectionBiomeEnd; // how many step before the end of an intersection. used to place the "Rock" object.
uniform float stepIndex;

${injectDefines(quality)}
#define INF 999.0

// utility functions

#define MIX_BIOMES(biomes,fn) mix(fn(biomes[0],biomes[3]),fn(biomes[1],biomes[3]),biomes[2])
#define MIX_BIOMES_2args(biomes,fn,arg1,arg2) mix(fn(arg1,arg2,biomes[0],biomes[3]),fn(arg1,arg2,biomes[1],biomes[3]),biomes[2])

float opU(float d1, float d2) {
  return min(d1, d2);
}
vec2 opU(vec2 d1, vec2 d2) {
  return mix(d1, d2, step(d2.x, d1.x));
}
float opUs(float k, float a, float b) {
  float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
  return mix( b, a, h ) - k*h*(1.0-h);
}
vec2 opUs(float k, vec2 d1, vec2 d2) {
  float v = opUs(k, d1.x, d2.x);
  return vec2(v, mix(d1.y, d2.y, step(d2.x, d1.x)));
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
  vec2 m = mix(parseTrackOffset(prev), parseTrackOffset(current), z);
  vec2 d = z * m; // produced curved interp, but not perfect yet.
  //rot2(p.xy, 0.5 * M_PI * m.x * z);
  p.xy -= d;
  rot2(p.xy, -0.8 * m.x); // also do a nice rotation effect opposite to the turn
  return p;
}

// game globals, precompute more things from main() for perf.
vec4 cartTrackPrev, cartTrackCurrent;
vec4 trackData[TRACK_SIZE_INT];
vec4 altTrackData[TRACK_SIZE_INT];
mat3 worldNoiseS, worldNoiseM, worldNoiseL; // various size of 3D noises. each have 3 row of perlin noise (from -1.0 to 1.0) that can be multiplied by a normal vector to produce nice 3D noise.


mat3 transpose(mat3 m) {
  return mat3(m[0][0], m[1][0], m[2][0],
              m[0][1], m[1][1], m[2][1],
              m[0][2], m[1][2], m[2][2]);
}

vec3 perlin3 (vec2 uv) { // pick 3 perlin noise value of a given position
  return 2.*(texture2D(perlin, fract(uv)).rgb-.5);
}

void syncNoise (vec3 worldP) {
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
vec2 sdRail (vec3 p, vec4 biomes) {
  float seed = biomes[3];
  float biome = biomes[0];
  float a = 2.*(seed - 0.5);
  float decay = 0.1 + 0.7*step(biome,B_DANG)*step(B_DANG,biome);
  a = a * a * a * mix(0.0, 0.3, decay);
  seed = mod(seed * 11., 1.);
  float b = mod(seed, 0.3);
  p -= vec3(0.0, -0.9, 0.0);
  // rails
  vec2 s = vec2(opU(
    sdBox(p - vec3(railw, 0.0, 0.5), railS),
    sdBox(p - vec3(-railw, 0.0, 0.5), railS)
  ), 6.0);
  // pylon
  s = opU(s, vec2(sdCappedCylinder(p - vec3(0.0, -10.03, 0.0), vec2(0.06, 10.0)), 4.));
  // first board
  s = opU(s, vec2(sdBox(p, boardS), 4.+mod(seed, 0.2)));
  // second
  p.z -= 0.33;
  p.y += 99.*step(seed - decay, 0.); // rarely missing
  rot2(p.xz, a);
  s = opU(s, vec2(sdBox(p, boardS), 4.+mod(a, 0.25)));
  // third
  p.z -= 0.33;
  p.y += 99.*step(mod(seed*2.,1.) - decay, 0.); // sometimes missing
  rot2(p.xz, -a+b);
  s = opU(s, vec2(sdBox(p, boardS), 4.+mod(b, 0.3)));
  return s;
}

float biomeWoodStructureDist (float biome, float trackSeed) {
  return 10.0 * (
    1.0
    - 0.95 * step(biome, B_WIRED) * step(B_WIRED, biome)
    - step(biome, B_DANG) * step(B_DANG, biome)
  );
}

float biomeHaveWalls (float biome, float trackSeed) {
  return 1.0
    - step(biome, B_INTERS) * step(B_INTERS, biome)
    - step(biome, B_VOID) * step(B_VOID, biome);
}

// TODO returns a vec3 because we want floor increment
vec3 biomeRoomSize (float biome, float trackSeed) {
  float dang = step(B_DANG, biome) * step(biome, B_DANG);
  float dark = step(B_DARK, biome) * step(biome, B_DARK);
  float a = mod(6.2 * trackSeed, 0.8);
  float b = mod(7.2 * trackSeed, 0.4);
  return vec3(
    2.0 + trackSeed - dang * (a * 0.5 + b),
    2.2 - dang * a,
    dang * (trackSeed + a - b)
  ) * ( 1.0 + dark );
}

float sdSphere (vec3 p, float s) {
  return length(p)-s;
}

#define WALL_WIDTH 100.0
vec2 sdTunnelWallStep (vec3 p, vec4 biomes, vec4 biomesPrev) {
  float haveWalls = MIX_BIOMES(biomes, biomeHaveWalls);
  haveWalls = step(0.01, haveWalls);
  vec3 sizeFrom = MIX_BIOMES(biomesPrev, biomeRoomSize);
  vec3 sizeTo = MIX_BIOMES(biomes, biomeRoomSize);
  float zMix = interpStepP(p);
  vec3 size = mix(sizeFrom, sizeTo, zMix);
  size.y = sizeTo.y;
  vec3 hs = vec3(WALL_WIDTH, size.y/2. + 2. * WALL_WIDTH, 0.5);
  vec3 ws = vec3(size.x/2. + 2. * WALL_WIDTH, WALL_WIDTH, 0.5);

  vec2 s = vec2(INF, 0.0);

  vec3 woodP = p;
  float biomeSeed = biomes[3];
  float dx = 0.3 * biomeSeed;
  float woodStructureDist = MIX_BIOMES(biomes, biomeWoodStructureDist);
  float woodW = 0.04 + mod(biomeSeed, 0.05);
  float woodT = 0.6 + woodStructureDist;
  float woodL = size.x * (0.4 + 0.1 * biomeSeed) + dx + woodStructureDist;
  float woodR = size.x * (0.5 - 0.1 * fract(9. * biomeSeed)) - dx + woodStructureDist;
  woodP = p;
  rot2(woodP.xy, 0.1 - mod(5.0*biomeSeed, 0.8));
  s = opU(s, vec2(sdBox(woodP - vec3(-woodL, 0.0, 0.0), vec3(woodW, 2.0, woodW)), 4.7));
  woodP = p;
  rot2(woodP.xy, mod(7.*biomeSeed, 0.8) - 0.1);
  s = opU(s, vec2(sdBox(woodP - vec3(woodR, 0.0, 0.0), vec3(woodW, 2.0, woodW)), 4.7));
  woodP = p;
  rot2(woodP.yz, 0.4 * fract(65.*biomeSeed) - 0.2);
  rot2(woodP.xy, 0.2 * fract(65.*biomeSeed) - 0.1);
  s = opU(s, vec2(sdBox(woodP - vec3(0.0, woodT, -woodW), vec3(2.0, woodW, woodW)), 4.7));

  // FIXME vary these based on biome factor...
  vec3 disp = vec3(0.);

  ${quality === "low"
    ? ""
    : GLSL`
  disp += vec3(
    0.14 * smoothstep(0.0, 0.2, worldNoiseL[1].x)
    - 0.08 * smoothstep(0.0, 0.4, worldNoiseM[1].x)
    - 0.02 * smoothstep(-0.2, 0.0, worldNoiseM[0].x)
    + 0.01 * smoothstep(-0.2, 0.0, worldNoiseS[1].x)
    + 0.03 * smoothstep(-0.4, -0.3, worldNoiseS[2].x),
    0.1 * smoothstep(-0.4, 0.2, worldNoiseM[0].y),
    0.2 * mix(
      mix(smoothstep(0.5, 0.6, worldNoiseM[0].z), 0.0, 0.5 * smoothstep(-0.4, 0.6, worldNoiseL[0].z)),
      0.5 * smoothstep(0.2, -0.6, worldNoiseS[0].z),
      0.8 * smoothstep(-0.4, 0.6, worldNoiseL[2].z)
    )
  );
`}
  p.y -= (size.y - 2.0) / 2.0;
  disp.z += 0.5;
  vec3 wallX = disp, wallY = disp;
  wallX.x += size.x/2. + WALL_WIDTH;
  wallY.y += size.y/2. + WALL_WIDTH;
  float left = sdBox(p-vec3(-1.0,1.0,1.0)*wallX, hs);
  float right = sdBox(p-wallX, hs);
  float up = sdBox(p-wallY, ws);
  p.y += size.z;
  float down = sdBox(p-vec3(0.0,-1.0,1.0) * wallY, ws);
  vec2 walls = vec2(opU(
    opU(up, down),
    opU(left, right)
  ), 1.0);
  s = mix(
    vec2(INF, 0.0),
    opU(s, walls),
    haveWalls
  );
  return s;
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
    vec2(head, 3.),
    vec2(stick, 0.6)
  );
}
${quality !== "high"
      ? ""
      : GLSL`
float sdCartWheel(vec3 p) {
  return opU(
    sdSphere(p - vec3(0.03, 0.0, 0.0), 0.04),
    opS(
      sdTorus(p.yxz, vec2(0.14, 0.04)),
      opI(
        sdBox(p, vec3(0.04, 0.14, 0.14)),
        sdSphere(p, 0.14)
      )
    )
  );
}
`}

const vec3 wheelOff = cartS * vec3(1.0, -1.0, 0.7) - vec3(0.0, 0.03, 0.0);
vec2 sdCart(vec3 p) {
  float w = 0.02;
  float b = 0.03;
  vec3 conv = vec3(mix(1.0, smoothstep(0.0, 2.*cartS.y, p.y), 0.3), 1.0, 1.0);
  p.y -= 0.18;
  float inside = opS(
    sdBox(p-vec3(0.0, w, 0.0), cartS*conv-vec3(w, 0.0, w)),
    sdBox(p, cartS * conv)
  );
  ${quality !== "high"
    ? ""
    : GLSL`
  float wheels=opU(
    opU(
      sdCartWheel(p - wheelOff),
      sdCartWheel(p - wheelOff * vec3(-1.0, 1.0, 1.0))
    ),
    opU(
      sdCartWheel(p - wheelOff * vec3(1.0, 1.0, -1.0)),
      sdCartWheel(p - wheelOff * vec3(-1.0, 1.0, -1.0))
    )
  );
  `}
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
  vec2 s = sdCartSwitch(p);

  float cartMaterial = 2.099;
${quality !== "high"
      ? ""
      : GLSL`
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
cartMaterial += 0.9 * oxydation;
s = opU(s, vec2(wheels, 0.1));
`}
  s = opU(s, vec2(opU(inside, border), cartMaterial));
  return s;
}

float biomeFly (float biome, float seed) {
  return step(B_DARK, biome) * step(biome, B_DARK) * (0.8 + seed) +
  step(seed, 0.02);
}
float biomeLamp (float biome, float seed) {
  return step(B_WIRED, biome) * step(biome, B_WIRED) * (0.4 + seed);
}
float biomeUFO (float biome, float seed) {
  return step(B_UFO, biome) * step(biome, B_UFO);
}

vec2 sdLamp (vec3 p) {
  vec2 s = vec2(sdSphere(p, 0.05), 7.0);
  s= opU(s, vec2(sdBox(p-vec3(0.,.5,0.), vec3(.01,.5,.02)), 0.05));
  return s;
}

vec2 sdObjectsStep (vec3 p, vec4 biomes, float z) {
  float absZ = stepIndex - z;
  vec2 o = sdRail(p, biomes);

  // FIXME optim, we might trace the objects in a diff way, with mod() on Z....

  float fly = MIX_BIOMES(biomes, biomeFly);
  float seed = biomes[3];
  float a = mod(49. * seed, 1.0);
  float b = mod(13. * seed, 1.0);
  vec3 offset = vec3(
    cos(0.8 * time + absZ),
    1.2 + sin(a + time * mod(absZ * b, 0.3)),
    0.2 * cos(5.0 * time + absZ)
  );
  o = opU(o, vec2(mix(
    INF,
    sdSphere(p - offset, 0.05),
    step(1.0, fly)
  ), 5.0 + 0.99 * a * b));

  float lamp = MIX_BIOMES(biomes, biomeLamp);
  vec3 lampP = p;
  float side = 2.0*(fract(absZ / 40.0) - 0.5);
  side = side * side * side;
  lampP -= vec3(
    side,
    0.2 + 0.6 * b,
    0.0
  );
  lampP.x += min(0.2, 0.5-lampP.y) * 0.5 * cos(mod(9.*absZ, 5.) * (time + absZ + lampP.y));
  o = opU(o, mix(
    vec2(INF),
    sdLamp(lampP),
    step(1.0, lamp)));

  return o;
}

vec2 sdStep (vec3 p, vec4 current, vec4 prev, float z) {
  vec4 biomes = parseTrackBiomes(current);
  vec4 biomesPrev = parseTrackBiomes(prev);
  vec3 stepP = interpStep(p, prev, current);
  return opU(
    sdTunnelWallStep(stepP, biomes, biomesPrev),
    sdObjectsStep(stepP, biomes, z)
  );
}

vec2 sdStepAlt (vec3 p, vec4 current, vec4 prev, float z) {
  vec4 biomes = parseTrackBiomes(current);
  vec3 stepP = interpStep(p, prev, current);
  return sdRail(stepP, biomes);
}

vec2 scene(vec3 p) {
  p.z -= 1.0;

  vec4 prev = trackData[0];
  vec4 current = trackData[1];
  vec4 biomes = parseTrackBiomes(current);

  vec2 m = mix(
    parseTrackOffset(cartTrackPrev),
    parseTrackOffset(cartTrackCurrent),
    trackStepProgress);

  vec3 ufoP = p;
  vec3 terrainDelta = terrainOffset + trackStepProgress * vec3(parseTrackOffset(cartTrackPrev), 1.0);
  vec3 terrainP = p + terrainDelta;
  vec3 altTerrainP = p + terrainDelta - altTrackOffset;
  vec3 cartP = p - vec3(0.0, -0.8, 0.3);
  rot2(cartP.xz, atan(-m.x));
  rot2(cartP.yz, atan(-m.y));

  syncNoise(p + terrainDelta + worldDelta);

  vec2 d = vec2(opU(
    max(0.0, TRACK_SIZE - p.z), // black wall at the end (too far to be visible)
    max(0.0, p.z + 1.0) // black wall before (you can't see behind anyway)
  ), 0.0);

  // Cart
  d = opU(d, sdCart(cartP));

  // Terrain
  p = terrainP;

  // prev step
  d = opU(d, sdStep(p, trackData[0], trackData[0], 0.0));

  // current step
  p -= vec3(parseTrackOffset(trackData[0]), 1.0);
  d = opU(d, sdStep(p, trackData[1], trackData[0], 1.0));

  // iterate next steps
  for (int z=2; z<TRACK_SIZE_INT; z++) {
    p -= vec3(parseTrackOffset(current), 1.0);
    prev = current;
    current = trackData[z];
    d = opU(d, sdStep(p, current, prev, float(z)));
  }

  // UFO
  float ufo = MIX_BIOMES(biomes, biomeUFO);
  float ufoClose = 0.5 + 0.4 * cos(time);
  ufoP = mix(ufoP, p, ufoClose);
  ufoP -= vec3(0.2 * cos(3. * time), 0.2 * sin(3. * time), 0.0);
  ufoP += 0.1 * worldNoiseS[0];
  float ufoS = sdSphere(ufoP, 0.15 * ufo);
  d = opU(d, mix(
    vec2(INF),
    vec2(ufoS, 8.0),
    step(0.01, ufo)));

  if (altTrackMode != ALTT_OFF) {
    p = altTerrainP;
    vec4 prev = altTrackData[0];
    vec4 current = altTrackData[1];

    // prev step
    d = opU(d, sdStepAlt(p, prev, prev, 0.0));

    // current step
    p -= vec3(parseTrackOffset(prev), 1.0);
    d = opU(d, sdStepAlt(p, current, prev, 1.0));

    // iterate next steps
    for (int z=2; z<TRACK_SIZE_INT; z++) {
      p -= vec3(parseTrackOffset(current), 1.0);
      prev = current;
      current = altTrackData[z];
      d = opU(d, sdStepAlt(p, current, prev, float(z)));
    }
  }

  return d;
}

vec3 sceneColor (float m, vec3 normal, float biome, float trackSeed) {
  vec3 c = vec3(0.0);
  float darkBiome = step(B_DARK,biome) * step(biome,B_DARK);
  float fireBiome = step(B_FIRE,biome) * step(biome,B_FIRE);
  float coalBiome = step(B_COAL,biome) * step(biome,B_COAL);
  float sapphireBiome = step(B_SAPPHIRE,biome) * step(biome,B_SAPPHIRE);
  float goldBiome = step(B_GOLD,biome) * step(biome,B_GOLD);
  float icyBiome = step(B_ICY,biome) * step(biome,B_ICY);
  float plantBiome = step(B_PLANT,biome) * step(biome,B_PLANT);
  float a = dot(worldNoiseM[0], normal);
  float b = dot(worldNoiseL[1], normal);
  float s = dot(worldNoiseS[0], normal);
  float plant = plantBiome * smoothstep(-0.2, 0., s);

  // 0.0 to 1.0 are generic metal where m value is the color
  c += step(m, 0.99) * m;

  // 1.+ : terrain
  m--;
  float goldRarity = trackSeed;
  c += step(0.0, m) * step(m, 0.999) * (
    vec3(0.22, 0.2, 0.18) +
    (
      fireBiome * vec3(0.9 + 0.3 * b + 0.2 * s, 0.2 - 0.2 * a, 0.3 * a) +
      sapphireBiome * vec3(0.0, 0.6, 1.2) +
      goldBiome * vec3(1.1, 0.7, 0.2) +
      plantBiome * vec3(-0.2, 0.1 * s - 0.1, -.3) +
      icyBiome * vec3(0.5, 0.8, 1.2) +
      0.05
      - 0.5 * coalBiome
    ) * (
      (
        icyBiome +
        max(0.5, -a * 10.0) * fireBiome * (1.0 + 0.5 * cos(4.0*time + 2.0 * M_PI * s))
      ) +
      mix(
        plantBiome,
        smoothstep(0.2-coalBiome, 0.3, a),
        smoothstep(-0.25, 0.6 * trackSeed, b)
      )
    )
  );

  // 2.+ : cart
  m--;
  c += step(0.0, m) * step(m, 0.999) * mix(
    vec3(0.5, 0.3, 0.1),
    vec3(0.8, 0.5, 0.2),
    m
  );

  // 3.+ : switch handle
  m--;
  c += step(0.0, m) * step(m, 0.9) * vec3(0.6, 0., 0.);

  // 4.+ : wood
  m--;
  c += step(0.0, m) * step(m, 0.99) * mix(
    mix(
      vec3(0.5, 0.3, 0.1),
      vec3(0.0, 0.1, 0.0),
      plant
    ),
    vec3(0.6, 0.8, 1.0),
    icyBiome
  ) * (1.0 - m - 0.9 * (fireBiome + coalBiome));

  // 5.+ : fly (firefly/insect, depends on places)
  m--;
  c += step(0.0, m) * step(m, 0.999) * mix(
    vec3(0.0),
    mix( //firefly in dark biome only
      vec3(.8, 3., 1.),
      vec3(.8, 2., 5.),
      m
    ),
    darkBiome
  );

  // 6.+ : rail metal
  m--;
  c += step(0.0, m) * step(m, 0.99) * (
    icyBiome +
    mix(
      mix(
        vec3(0.7),
        vec3(8.0, 2.0, 1.0),
        fireBiome
      ),
      vec3(0.0, 0.1, 0.0),
      plant
    )
  );

  // 7.+ : lamp
  m--;
  c += step(0.0, m) * step(m, 0.99) * vec3(2.0, 1.2, 0.8);

  // 8.+ : ufo
  m--;
  c += step(0.0, m) * step(m, 0.99) * (
    0.7 + 0.8 * vec3(
      cos(4.*time),
      sin(11.*time),
      sin(3.*time)
    )
  );

  return c;
}

vec3 biomeAmbientColor (float b, float seed) {
  return vec3(0.2)
  + step(B_DARK, b) * step(b, B_DARK) * vec3(-0.4)
  + step(B_SAPPHIRE,b) * step(b,B_SAPPHIRE) * vec3(0.0, 0.3, 0.8)
  + step(B_WIRED,b) * step(b,B_WIRED) * vec3(.4,.3,.1)
  + step(B_FIRE,b) * step(b,B_FIRE) * vec3(0.3, 0.2, 0.0);
}

vec2 biomeFogRange (float b, float seed) {
  return vec2(
    0.5
      - 0.4 * step(B_FIRE, b) * step(b, B_FIRE)
      - 0.4 * step(B_ICY, b) * step(b, B_ICY)
      - 0.2 * step(B_INTERS, b) * step(b,B_INTERS)
      - 0.51 * step(B_FINISH, b) * step(b, B_FINISH),
    1.0 - step(B_FINISH, b) * step(b, B_FINISH)
  ) * TRACK_SIZE;
}

vec3 biomeFogColor (float b, float seed) {
  // nice way to "announce" some biome coming in far forward
  return vec3(
    step(B_FINISH, b) * step(b, B_FINISH) * 0.9
    + step(B_INTERS, b) * step(b, B_INTERS) * 0.1
    + step(B_FIRE, b) * step(b, B_FIRE) * 0.2
  )
  + step(B_ICY, b) * step(b, B_ICY) * vec3(0.6, 0.7, 0.8);
}

vec2 raymarch(vec3 position, vec3 direction) {
  float total_distance = 0.1;
  vec2 result;
  for (int i = 0; i < N_MARCH; ++i) {
    vec3 p = position + direction * total_distance;
    result = scene(p);
    total_distance += result.x;
    if (result.x < 0.002) return vec2(total_distance, result.y);
  }
  return vec2(total_distance, result.y);
}

${normalFunction(quality)}

void main() {
  // Set some Global Vars..
  for (int i=0; i<TRACK_SIZE_INT; i++) {
    trackData[i] = texture2D(track, vec2((0.5+float(i))/TRACK_SIZE, 0.5));
  }
  if (altTrackMode == ALTT_CART_ON) {
    cartTrackPrev = altTrackData[0];
    cartTrackCurrent = altTrackData[1];
  } else {
    cartTrackPrev = trackData[0];
    cartTrackCurrent = trackData[1];
  }
  if (altTrackMode != ALTT_OFF) {
    for (int i=0; i<TRACK_SIZE_INT; i++) {
      altTrackData[i] = texture2D(altTrack, vec2((0.5+float(i))/TRACK_SIZE, 0.5));
    }
  }

  // Start the scene rendering
  vec3 direction = normalize(rot * vec3(uv, 2.5));
  vec2 result = raymarch(origin, direction);
  vec3 intersection = origin + direction * result.x;
  vec3 nrml = normal(intersection, 0.02);

  float z = max(0.0, min(intersection.z + trackStepProgress - 1.0, TRACK_SIZE-1.0));
  float zIndex = floor(z);
  float zFract = z - zIndex;

  vec4 toData = texture2D(track, vec2((zIndex+0.5)/TRACK_SIZE, 0.5));
  vec4 fromData = texture2D(track, vec2((max(1.0, zIndex)-0.5)/TRACK_SIZE, 0.5));
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

  vec3 light_dir = normalize(vec3(0.4, 0.5, -1.0));
  float diffuse = dot(light_dir, nrml);
  diffuse = mix(diffuse, 1.0, 0.5); // half diffuse
  vec3 diffuseLit;
  vec3 lightColor = vec3(1.0, 0.9, 0.8);
  float fog = smoothstep(fogRange[0], fogRange[1], result.x);
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
      terrainOffset: regl.prop("terrainOffset"),
      altTrack: regl.prop("altTrack"),
      altTrackOffset: regl.prop("altTrackOffset"),
      altTrackMode: regl.prop("altTrackMode"),
      switchDirection: regl.prop("switchDirection"),
      intersectionBiomeEnd: regl.prop("intersectionBiomeEnd"),
      stepIndex: regl.prop("stepIndex")
    },

    count: 3
  });
