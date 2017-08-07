import * as Constants from "../Constants";
import GLSL from "./GLSL";

const constantsUsingIntType = {
  MARCH_N: 1
};

const INJECT = Object.keys(Constants)
  .map(k => {
    const v = Constants[k];
    if (v === false) return "";
    if (v === true) return `#define ${k}`;
    if (typeof v !== "number") return "";
    if (constantsUsingIntType[k]) {
      return `#define ${k} ${Math.floor(v)}`;
    }
    return `#define ${k} ${v.toFixed(6)}`;
  })
  .filter(v => v)
  .join("\n");

export default (regl, framebuffer) =>
  regl({
    framebuffer,
    frag: GLSL`
precision highp float;
// global
varying vec2 uv;
uniform float time, aspect;
uniform sampler2D perlin;
// camera
uniform vec3 debugOrigin;
uniform mat3 rot;
// game state
uniform sampler2D track; // 8x1 data texture
uniform float trackStepProgress;
uniform sampler2D altTrack; // 8x1 data texture
uniform vec3 altTrackOffset;
uniform float altTrackMode;
uniform float switchDirection;
uniform float braking;
uniform float speed;

${INJECT}
#define INF 999.0

// utility functions

#define MIX_BIOMES(fn,biomes) mix(fn(biomes[0],biomes[3]),fn(biomes[1],biomes[3]),biomes[2])

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
  float f = raw[2];
  f *= 16.0;
  float biome1 = floor(f);
  f -= biome1;
  f *= 16.0;
  float biome2 = floor(f);
  f = raw[3];
  f *= 16.0;
  float biomeMix = floor(f);
  f -= biomeMix;
  biomeMix /= 15.0; // NB from 0 to 1 inclusive
  f *= 16.0;
  float biomeSeed = floor(f);
  biomeSeed /= 16.0;
  return vec4(biome1, biome2, biomeMix, biomeSeed);
}
float interpStepP (vec3 p) {
  return max(0.0, min(p.z, 1.0));
}
vec3 interpStep (vec3 p, vec4 prev, vec4 current) {
  float z = interpStepP(p);
  vec2 d = z * mix(parseTrackOffset(prev), parseTrackOffset(current), z); // produced curved interp, but not perfect yet.
  return p - vec3(d, 0.0);
}

// game shapes

const float railw = 0.3;
const vec3 railS = vec3(0.04, 0.08, 0.5);
const vec3 boardS = vec3(railw, 0.02, 0.05);
vec2 sdRail (vec3 p) {
  float rail = opU(
    sdBox(p - vec3(railw, 0.0, 0.5), railS),
    sdBox(p - vec3(-railw, 0.0, 0.5), railS)
  );
  float board = sdBox(p, boardS);
  for (float f=0.; f<1.0; f+=0.25) {
    board = opU(board, sdBox(p - vec3(0.0, 0.0, f), boardS));
  }
  float pylon = sdCappedCylinder(p - vec3(0.0, -1.03, 0.0), vec2(0.06, 1.0));
  return opU(opU(
    vec2(rail, 3.0),
    vec2(board, 4.0)
  ), vec2(pylon, 5.0));
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

bool biomeHaveWalls (float biome) {
  return biome!=0.0;
}

vec2 biomeRoomSize (float biome, float biomeSeed) {
  vec2 sz = vec2(2.0, 2.0);
  sz += vec2(1.0 * biomeSeed, 2.0 * step(0.8, biomeSeed));
  return sz;
}

#define WALL_WIDTH 50.0
float sdTunnelWallStep (vec3 p, vec4 data, vec4 prev) {
  vec4 biomes = parseTrackBiomes(data);
  bool haveWalls = biomeHaveWalls(biomes[0]);
  if (!haveWalls) return INF;
  vec4 biomesPrev = parseTrackBiomes(prev);
  vec2 sizeFrom = MIX_BIOMES(biomeRoomSize, biomesPrev);
  vec2 sizeTo = MIX_BIOMES(biomeRoomSize, biomes);
  float zMix = interpStepP(p);
  vec2 size =
  vec2(mix(sizeFrom.x, sizeTo.x, zMix), sizeTo.y);
  p.y -= (size.y - 2.0) / 2.0;
  // TODO interp size with Z and prev
  vec3 hs = vec3(WALL_WIDTH, size.y/2. + 2. * WALL_WIDTH, 0.5);
  vec3 ws = vec3(size.x/2. + 2. * WALL_WIDTH, WALL_WIDTH, 0.5);
  float dx = size.x/2. + WALL_WIDTH;
  float dy = size.y/2. + WALL_WIDTH;
  float left = sdBox(p-vec3(-dx, 0., 0.5), hs);
  float right = sdBox(p-vec3(dx, 0., 0.5), hs);
  float up = sdBox(p-vec3(0., dy, 0.5), ws);
  float down = sdBox(p-vec3(0., -dy, 0.5), ws);
  return 0.8 * opUs(
    0.1,
    opU(up, down),
    opU(left, right)
  );
}


vec2 sdRailStep (vec3 p, vec4 data) {
  float h = 2.0;
  return sdRail(p - vec3(0.0, -h / 2.0, 0.0));
}

vec2 sdCartSwitch (vec3 p) {
  float h = 0.3;
  float sh = 0.05;
  p.y += h;
  rot2(p.xy, -0.4 * switchDirection);
  p.y -= h;
  return opU(
    vec2(sdBox(p - vec3(0., h - sh / 2., 0.), vec3(0.02, sh, 0.02)), 6.),
    vec2(sdBox(p, vec3(0.01, h, 0.01)), 7.)
  );
}

vec2 sdCart(vec3 p) {
  p.y -= 0.2;
  vec3 cartS = vec3(0.35, 0.25, 0.5);
  float w = 0.03;
  float b = 0.04;
  float inside = opS( // FIXME how to actually make it smaller on bottom?
    sdBox(p-vec3(0.0, w, 0.0), cartS-vec3(w, 0.0, w)),
    sdBox(p, cartS)
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
  return opU(opU(
    vec2(inside, 2.1 + 0.9 * oxydation - 0.001),
    vec2(border, 2.0)),
    cartSwitch
  );
}

vec2 scene(vec3 p) {
  vec2 d = opU(
    vec2(max(0.0, TRACK_SIZE - p.z), 0.0), // black wall at the end (too far to be visible)
    vec2(max(0.0, p.z - 0.0), 0.0) // black wall before (you can't see behind anyway)
  );
  vec4 prev = texture2D(track, vec2(0.5/TRACK_SIZE, 0.5));
  vec4 current = texture2D(track, vec2(1.5/TRACK_SIZE, 0.5));
  vec2 m = mix(parseTrackOffset(prev), parseTrackOffset(current), trackStepProgress);

  p.z -= 1.0;

  // Cart
  vec3 cartP = p;
  cartP -= vec3(0.0, -0.8, 0.3);
  rot2(cartP.yz, atan(-m.y));
  rot2(cartP.xz, atan(-m.x));
  d = opU(d, sdCart(cartP));

  // Terrain
  p += trackStepProgress * vec3(parseTrackOffset(prev), 1.0);
  vec3 originStepP = p;

  // prev step
  vec3 stepP = interpStep(p, prev, prev);
  vec2 rails = sdRailStep(stepP, prev);
  float tunnel = sdTunnelWallStep(stepP, prev, prev);

  // current step
  p -= vec3(parseTrackOffset(prev), 1.0);
  stepP = interpStep(p, prev, current);
  rails = opU(rails, sdRailStep(stepP, current));
  tunnel = opU(tunnel, sdTunnelWallStep(stepP, current, prev));

  // iterate next steps
  for (float z=2.0; z<TRACK_SIZE; z++) {
    p -= vec3(parseTrackOffset(current), 1.0);
    prev = current;
    current = texture2D(track, vec2((z+0.5)/TRACK_SIZE, 0.5));
    stepP = interpStep(p, prev, current);
    rails = opU(rails, sdRailStep(stepP, current));
    tunnel = opU(tunnel, sdTunnelWallStep(stepP, current, prev));
  }

  if (altTrackMode > 0.0) {
    vec4 prev = texture2D(altTrack, vec2(0.5/TRACK_SIZE, 0.5));
    vec4 current = texture2D(altTrack, vec2(1.5/TRACK_SIZE, 0.5));
    p = originStepP - altTrackOffset;

    // prev step
    stepP = interpStep(p, prev, prev);
    rails = opU(rails, sdRailStep(stepP, prev));

    // current step
    p -= vec3(parseTrackOffset(prev), 1.0);
    stepP = interpStep(p, prev, current);
    rails = opU(rails, sdRailStep(stepP, current));

    // iterate next steps
    for (float z=2.0; z<TRACK_SIZE; z++) {
      p -= vec3(parseTrackOffset(current), 1.0);
      prev = current;
      current = texture2D(altTrack, vec2((z+0.5)/TRACK_SIZE, 0.5));
      stepP = interpStep(p, prev, current);
      rails = opU(rails, sdRailStep(stepP, current));
    }
  }

  d = opU(d, vec2(tunnel, 1.0));
  d = opU(d, rails);

  return d;
}

vec3 sceneColor (float m) {
  if (m < 0.0) {
    return vec3(0.0);
  }
  else if (m < 1.0) {
    return vec3(0.0);
  }
  else if (m < 2.0) { // terrain
    return vec3(0.2, 0.15, 0.1);
  }
  else if (m < 3.0) { // cart metal
    return mix(
      vec3(0.15, 0.12, 0.13),
      vec3(0.5, 0.3, 0.0),
      fract(m)
    );
  }
  else if (m < 4.0) { // rail
    return vec3(0.8);
  }
  else if (m < 5.0) { // wood
    return vec3(0.5, 0.3, 0.0);
  }
  else if (m < 6.0) { // pylon
    return vec3(0.5, 0.3, 0.0);
  }
  else if (m < 7.0) { // cart switch
    return vec3(0.6, 0., 0.);
  }
  else if (m < 8.0) { // cart switch metal
    return vec3(0.4);
  }
  return vec3(0.0);
}

vec3 biomeAmbientColor (float b, float seed) {
  if (b==B_DARK) {
    return vec3(-.3);
  }
  return vec3(.5);
}

vec2 biomeFogRange (float b, float seed) {
  if (b ==15.) {
    return vec2(-0.1, 0.);
  }
  return vec2(0.5 * TRACK_SIZE, TRACK_SIZE);
}

vec3 biomeFogColor (float b, float seed) {
  return vec3(step(14.5, b));
}

vec2 raymarch(vec3 position, vec3 direction) {
  float total_distance = 0.1;
  vec2 result;
  for(int i = 0; i < MARCH_N; ++i) {
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
  vec3 direction = normalize(rot * vec3(uv * vec2(aspect, 1.0), 2.5));
  vec3 o = debugOrigin + vec3(0.0, 0.05, 1.4 + min(0.0, 0.2 * braking - 0.2 * smoothstep(0.0, 6.0, speed)));
  vec2 result = raymarch(o, direction);
  vec3 intersection = o + direction * result.x;
  vec3 nrml = normal(intersection, 0.02);
  vec3 materialColor = sceneColor(result.y);

  float z = max(0.0, min(intersection.z + trackStepProgress - 1.0, TRACK_SIZE-1.0));
  float zIndex = floor(z);
  float zFract = z - zIndex;

  vec4 toData = texture2D(track, vec2((zIndex+0.5)/TRACK_SIZE, 0.5));
  vec4 fromData = zIndex>0.0 ? texture2D(track, vec2((zIndex-0.5)/TRACK_SIZE, 0.5)) : toData;
  vec4 fromBiomes = parseTrackBiomes(fromData);
  vec4 toBiomes = parseTrackBiomes(toData);

  vec3 light_dir = normalize(vec3(0.0, 1., -0.5));
  float diffuse = dot(light_dir, nrml);
  diffuse = mix(diffuse, 1.0, 0.5); // half diffuse
  vec3 diffuseLit;
  vec3 lightColor = vec3(1., 0.9, 0.7);

  vec3 ambientColor = mix(
    MIX_BIOMES(biomeAmbientColor, fromBiomes),
    MIX_BIOMES(biomeAmbientColor, toBiomes),
    zFract
  );
  vec3 fogColor = mix(
    MIX_BIOMES(biomeFogColor, fromBiomes),
    MIX_BIOMES(biomeFogColor, toBiomes),
    zFract
  );
  vec2 fogRange = mix(
    MIX_BIOMES(biomeFogRange, fromBiomes),
    MIX_BIOMES(biomeFogRange, toBiomes),
    zFract
  );

  float fog = smoothstep(fogRange[0], fogRange[1], result.x);

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
      aspect: regl.prop("aspect"),
      rot: regl.prop("rot"),
      origin: regl.prop("origin"),
      track: regl.prop("track"),
      trackStepProgress: regl.prop("trackStepProgress"),
      altTrack: regl.prop("altTrack"),
      altTrackOffset: regl.prop("altTrackOffset"),
      altTrackMode: regl.prop("altTrackMode"),
      switchDirection: regl.prop("switchDirection"),
      braking: regl.prop("braking"),
      debugOrigin: regl.prop("debugOrigin"),
      speed: regl.prop("speed")
    },

    count: 3
  });
