//@flow

export type vec3 = [number, number, number];

export type Biome = {
  biomeSeed: number,
  type: number
};

export type UniqueBiome = {
  biome: Biome,
  index: number,
  duration: number
};

export type Track = {
  turn: number,
  descent: number,
  biome1: Biome,
  biome2: Biome,
  biomeMix: number,
  trackSeed: number,
  trackIndex: number,
  uniqueBiome: ?UniqueBiome
};

export type GameState = {
  status: *,
  altTrack: Array<Track>,
  time: number,
  stepTime: number,
  tick: number,
  stepTick: number,
  stepIndex: number,
  trackStepProgress: number,
  rotX: number,
  rotY: number,
  rot: Array<number>,
  track: Array<Track>,
  seed: number,
  level: number,
  speed: number, // z-unit per second
  acc: number,
  braking: number, // braking factor
  switchDirectionTarget: number,
  switchDirection: number,
  altTrack: Array<Track>, // wrong turn track data
  altTrackMode: *,
  altTrackOffset: vec3, // how many x,y does track starts
  stateAtMouseDown: null,
  debugOrigin: vec3
};
