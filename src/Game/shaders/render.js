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

const materialSpecularIntensity = qualityResolver({
  low: GLSL`float materialSpecularIntensity (float m) {
    return 0.;
  }`,
  default: GLSL`
float materialSpecularIntensity (float m) {
  return step(6., m) * step(m, 6.999) + step(2., m) * step(m, 2.999);
}
`
});

const sceneNormal = qualityResolver({
  low: GLSL`\
vec3 sceneNormal(vec3 p) {
  return vec3(0.0, 1.0, 0.0);
}
`,
  // medium normal is not a true normal calc but an estimation
  medium: GLSL`\
vec3 sceneNormal(vec3 p) {
  return normalize(vec3(
    - scene(p - vec3(NORMAL_EPSILON, 0., 0.)).x,
    - scene(p - vec3(0., NORMAL_EPSILON, 0.)).x,
    - scene(p - vec3(0.,0.,NORMAL_EPSILON)).x
  ));
}`,
  high: GLSL`\
vec3 sceneNormal(vec3 p) {
  return normalize(vec3(
    scene(p + vec3(NORMAL_EPSILON, 0., 0.)).x - scene(p - vec3(NORMAL_EPSILON, 0., 0.)).x,
    scene(p + vec3(0., NORMAL_EPSILON, 0.)).x - scene(p - vec3(0., NORMAL_EPSILON, 0.)).x,
    scene(p + vec3(0.,0.,NORMAL_EPSILON)).x - scene(p - vec3(0.,0.,NORMAL_EPSILON)).x
  ));
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
uniform float altTrackFailures;

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
float vmin(vec2 v) {
	return min(v.x, v.y);
}
float vmax(vec3 v) {
	return max(max(v.x, v.y), v.z);
}

// generic shapes

float sdCappedCylinder(vec3 p, vec2 h) {
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}
float sdBoxWindow(vec3 p, vec3 b) {
  return max(abs(p.z) - b.z, vmin(b.xy - abs(p.xy)));
}
float sdBox(vec3 p, vec3 b) {
  return vmax(abs(p) - b); // cheap version
}
float sdSphere (vec3 p, float s) {
  return length(p)-s;
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
  vec2 d = z * m; // produced curved interp, approximation
  p.xy -= d;
  rot2(p.xy, -0.8 * m.x); // rotation effect opposite to the turn
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
  float decay = 0.1 + 0.7*step(biome,B_CLIFF) * step(B_CLIFF,biome);
  p -= vec3(0.0, -0.9, 0.0);
  // rails
  vec2 s = vec2(sdBox(vec3(abs(p.x) - railw, p.y, p.z - 0.5), railS), 6.0);
  p.y += INF * step(seed - .5 * decay, 0.); // rarely missing
  // pylon
  s = opU(s, vec2(sdCappedCylinder(p - vec3(0.0, -5.03, 0.0), vec2(0.06, 5.0)), 4.));
  // first board
  s = opU(s, vec2(sdBox(p, boardS), 4. + .2 * seed));
  // second
  p.z -= 0.33;
  seed = fract(seed * 7.);
  p.y += INF * step(seed - .8 * decay, 0.); // rarely missing
  rot2(p.xz, seed - 0.5);
  s = opU(s, vec2(sdBox(p, boardS), 4. + .2 * seed));
  // third
  p.z -= 0.33;
  seed = fract(seed * 7.);
  p.y += INF * step(seed - decay, 0.); // sometimes missing
  rot2(p.xz, seed - 0.5);
  s = opU(s, vec2(sdBox(p, boardS), 4. + .3 * seed));
  return s;
}

float biomeWoodStructureDist (float biome, float trackSeed) {
  return 10.0 * (
    1.0
    - 0.95 * step(biome, B_WIRED) * step(B_WIRED, biome)
    - 0.9 * step(biome, B_CLIFF) * step(B_CLIFF, biome)
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
  float cliff = step(B_CLIFF, biome) * step(biome, B_CLIFF);
  float a = fract(2. * trackSeed);
  float b = fract(3. * trackSeed);
  b = b * b;
  return vec3(
    1.0 + 0.4 * trackSeed - 0.2 * b - 0.2 * dang * a,
    1.2 + 0.3 * b - dang * a * 0.3 + INF * cliff,
    dang * (0.5 * trackSeed + a * a - b * 0.2) + INF * cliff
  ) * ( 1.0 + dark );
}

vec2 sdTunnelWallStep (vec3 originP, vec4 biomes, vec4 biomesPrev) {
  float zMix = interpStepP(originP);
  vec3 size = mix(
    MIX_BIOMES(biomesPrev, biomeRoomSize),
    MIX_BIOMES(biomes, biomeRoomSize),
    zMix);

  // Walls
  vec3 p = originP;
  p -= vec3(
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

  p.y -= size.y - 1.0;
  size.y += size.z;
  p.y += size.z;
  vec2 s = vec2(sdBoxWindow(p, vec3(size.xy, 0.5)), 1.0);

  // Wood Structures
  float biomeSeed = biomes[3];
  float a = fract(biomeSeed * 3.);
  float b = fract(biomeSeed * 7.);
  float c = fract(biomeSeed * 11.);
  float dx = 0.3 * biomeSeed;
  float woodStructureDist = MIX_BIOMES(biomes, biomeWoodStructureDist);
  float woodW = 0.04 + 0.05 * a;
  float woodT = 0.6 + woodStructureDist;
  float woodL = size.x * (0.8 + 0.2 * biomeSeed) + dx + woodStructureDist;
  float woodR = size.x * (1. - 0.2 * a) - dx + woodStructureDist;
  p = originP;
  rot2(p.xy, 0.1 - 0.8 * a);
  s = opU(s, vec2(sdBox(p - vec3(-woodL, 0.0, 0.0), vec3(woodW, 2.0, woodW)), 4.7));
  p = originP;
  rot2(p.xy, 0.8 * b - 0.1);
  s = opU(s, vec2(sdBox(p - vec3(woodR, 0.0, 0.0), vec3(woodW, 2.0, woodW)), 4.7));
  p = originP;
  rot2(p.yz, 0.4 * c - 0.2);
  rot2(p.xy, 0.2 * c - 0.1);
  s = opU(s, vec2(sdBox(p - vec3(0.0, woodT, -woodW), vec3(2.0, woodW, woodW)), 4.7));
  // TODO all of these is too much code, got to be smarter.

  return mix(
    vec2(INF),
    s,
    step(0.01, MIX_BIOMES(biomes, biomeHaveWalls))
  );
}

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

vec2 sdCart(vec3 p, float d) {
  vec3 boxSize = vec3(
    0.2 + 0.1 * smoothstep(-0.1, 0.25, p.y),
    0.25,
    0.4
  );
  // body
  float metal = opS(
    sdBox(p - vec3(0.0, 0.03, 0.0), boxSize - vec3(0.03, 0.0, 0.03)),
    sdBox(p, boxSize)
  );
  // wheel
  metal = opU(metal, sdCartWheel(vec3(
    abs(p.x) - 0.3,
    p.y + 0.26,
    abs(p.z) - 0.28
  )));

  p.y -= boxSize.y;
  p.z -= boxSize.z;

  vec3 lampP = vec3(
     abs(p.x) - 0.9 * boxSize.x,
     p.y + 0.04,
     p.z - 0.04
  );
  metal = opU(metal, opS(
    sdSphere(lampP - vec3(0.0, 0.0, 0.09), 0.1),
    sdSphere(lampP, 0.08)
  ));

  vec3 switchP = p;
  switchP.y += 0.3;
  rot2(switchP.xy, -0.4 * d);
  switchP.y -= 0.3;
  // stick
  metal = opU(metal, sdBox(switchP, vec3(0.01, 0.3, 0.01)));
  switchP.y -= 0.285;
  // head
  metal = opU(metal, sdSphere(switchP, 0.03));

  float bodyPart = step(-0.04, p.y);
  float cartMaterial = 2.199;
${quality !== "high"
      ? ""
      : GLSL`
p -= 0.5;
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
oxydation * smoothstep(0.5, 0.57, s2.z);
float o2 = smoothstep(0.3, 0.28, s2.y);
oxydation = mix(oxydation, o2, o2);
cartMaterial += 0.8 * oxydation;
`}

  cartMaterial = mix(cartMaterial, 2.7, bodyPart);
  return vec2(metal, cartMaterial);
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
  vec2 o = vec2(INF);

  float fly = MIX_BIOMES(biomes, biomeFly);
  float seed = biomes[3];
  float a = fract(49. * seed);
  float b = fract(13. * seed);
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
  vec2 s = sdRail(stepP, biomes);
  s = opU(s, sdTunnelWallStep(stepP, biomes, biomesPrev));
  s = opU(s, sdObjectsStep(stepP, biomes, z));
  return s;
}


vec2 sdStepAlt (vec3 p, vec4 current, vec4 prev, float z) {
  vec4 biomes = parseTrackBiomes(current);
  vec3 stepP = interpStep(p, prev, current);
  vec2 s = sdRail(stepP, biomes);
  float seed = biomes[3];
  float cartNotVisible = step(altTrackFailures, TRACK_SIZE-z);
  vec3 cartP = stepP - vec3(0.,-0.3-cartNotVisible*INF,-0.5);
  rot2(cartP.yz, fract(seed*3.)-0.5);
  rot2(cartP.xz, seed-0.5);
  s = opU(s, sdCart(cartP, 2.*(seed-.5)));
  return s;
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
  vec3 cartP = p - vec3(0.0, -0.6, 0.3);
  rot2(cartP.xz, atan(-m.x));
  rot2(cartP.yz, atan(-m.y));

  syncNoise(p + terrainDelta + worldDelta);

  vec2 d = vec2(opU(
    max(0.0, TRACK_SIZE - p.z), // black wall at the end (too far to be visible)
    max(0.0, p.z + 1.0) // black wall before (you can't see behind anyway)
  ), 0.0);

  // Cart
  d = opU(d, sdCart(cartP, switchDirection));

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

${materialSpecularIntensity(quality)}

vec3 materialColor (float m, vec3 normal, float biome, float trackSeed) {
  vec3 c = vec3(0.0);
  float darkBiome = step(B_DARK,biome) * step(biome,B_DARK);
  float fireBiome = step(B_FIRE,biome) * step(biome,B_FIRE);
  float coalBiome = step(B_COAL,biome) * step(biome,B_COAL);
  float copperBiome = step(B_COPPER,biome) * step(biome,B_COPPER);
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
    copperBiome * vec3(0.5 + 0.2 * a, 0.2 + 0.2 * min(0., a + b + s), 0.0) * (.8 + 4. * b * b) +
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
  ) * (1.0 - m - 0.9 * (fireBiome + coalBiome + copperBiome));

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
    icyBiome
    + mix(
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
  + step(B_SAPPHIRE,b) * step(b,B_SAPPHIRE) * vec3(0.0, 0.4, 1.0)
  + step(B_WIRED,b) * step(b,B_WIRED) * vec3(.4,.3,.1)
  + step(B_FIRE,b) * step(b,B_FIRE) * vec3(0.3, 0.2, 0.0);
}

vec2 biomeFogRange (float b, float seed) {
  return vec2(
    0.5
      - 0.4 * step(B_FIRE, b) * step(b, B_FIRE)
      - 0.4 * step(B_ICY, b) * step(b, B_ICY)
      - 0.9 * step(B_COPPER, b) * step(b, B_COPPER)
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
  + step(B_COPPER,b) * step(b,B_COPPER) * vec3(0.7, 0.4, 0.2)
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

${sceneNormal(quality)}

void main() {
  // Set some Global Vars..
  for (int i=0; i<TRACK_SIZE_INT; i++) {
    trackData[i] = texture2D(track, vec2((0.5+float(i))/TRACK_SIZE, 0.5));
  }
  if (altTrackMode != ALTT_OFF) {
    for (int i=0; i<TRACK_SIZE_INT; i++) {
      altTrackData[i] = texture2D(altTrack, vec2((0.5+float(i))/TRACK_SIZE, 0.5));
    }
  }
  if (altTrackMode == ALTT_CART_ON) {
    cartTrackPrev = altTrackData[0];
    cartTrackCurrent = altTrackData[1];
  } else {
    cartTrackPrev = trackData[0];
    cartTrackCurrent = trackData[1];
  }

  // Start the scene rendering
  vec3 direction = normalize(rot * vec3(uv, 2.5));
  vec2 result = raymarch(origin, direction);
  float material = result.y;
  float dist = result.x;
  vec3 intersection = origin + direction * dist;
  vec3 normal = sceneNormal(intersection);

  float z = max(0.0, min(intersection.z + trackStepProgress - 1.0, TRACK_SIZE-1.0));
  float zIndex = floor(z);
  float zFract = z - zIndex;

  vec4 toData = texture2D(track, vec2((zIndex+0.5)/TRACK_SIZE, 0.5));
  vec4 fromData = texture2D(track, vec2((max(1.0, zIndex)-0.5)/TRACK_SIZE, 0.5));
  vec4 fromBiomes = parseTrackBiomes(fromData);
  vec4 toBiomes = parseTrackBiomes(toData);

  vec3 materialColor = mix(
    MIX_BIOMES_2args(fromBiomes, materialColor, material, normal),
    MIX_BIOMES_2args(toBiomes, materialColor, material, normal),
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

  vec3 lightDir = normalize(vec3(0.1, 0.2, -1.0));
  float diffuse = dot(lightDir, normal);
  diffuse = mix(diffuse, 1.0, 0.5); // half diffuse

  vec3 lightReflect = normalize(reflect(lightDir, normal));
  float specular = dot(-direction, lightReflect);
  specular = pow(specular, 4.0);
  float matSpecularIntensity = materialSpecularIntensity(material);

  vec3 diffuseLit;
  vec3 lightColor = vec3(1.0, 0.9, 0.8);
  float fog = smoothstep(fogRange[0], fogRange[1], dist);
  diffuseLit = mix(materialColor * (diffuse * lightColor + ambientColor + specular * lightColor * matSpecularIntensity), fogColor, fog);
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
      stepIndex: regl.prop("stepIndex"),
      altTrackFailures: regl.prop("altTrackFailures")
    },

    count: 3
  });
