//@flow

export type vec3 = [number, number, number];

export type Quality = "high" | "medium" | "low";

export type UserEvents = {
  keys: { [_: number]: number },
  keyRightDelta: number,
  keyUpDelta: number,
  spacePressed: number,
  mouseDown: [number, number],
  mouseAt: [number, number]
};

export type Biome = {
  biomeIndex: number,
  biomeSeed: number,
  type: number,
  isSafe: boolean
};

export type TrackBiome = Biome & {
  index: number, // the index, starts in negative because fading
  duration: number // the duration without including the fading
};

export type Track = {
  turn: number,
  descent: number,
  biome1: TrackBiome,
  biome2: TrackBiome,
  biomeMix: number,
  trackSeed: number,
  trackIndex: number,
  uniqueBiome: ?TrackBiome,
  intersectionBiome: ?TrackBiome
};

export type UIState = {
  logo?: boolean,
  title?: string,
  footer?: string,
  body?: string,
  area?: string,
  titleCentered?: boolean,
  footerCentered?: boolean,
  footerBlink?: boolean,
  black?: boolean
};

export type AudioState = {
  volume: number, // global volume
  speed: number, // this is a digest value of speed factor, from 0 to 1
  braking: number,
  descentShake: number,
  turnShake: number,
  biomesProximity: Array<number>,
  triggerSwitchChange: boolean,
  triggerCartAccident: boolean,
  triggerLightCartAccident: boolean,
  triggerIntersectionSwitch: boolean
};

export type GameState = {
  seed: string,
  username: string,
  quality: Quality,
  audioState: AudioState,
  uiState: ?UIState,
  uiStateBlinkTick: boolean,
  status: number,
  altTrack: Array<Track>,
  tutorial: number,
  time: number,
  startTime: number,
  statusChangedTime: number,
  stepTime: number,
  tick: number,
  stepTick: number,
  stepIndex: number,
  trackStepProgress: number,
  rotX: number,
  rotY: number,
  rot: Array<number>,
  track: Array<Track>,
  level: number,
  levelReached: number, // in case of success it's level+1
  speed: number, // z-unit per second
  acc: number,
  braking: number, // braking factor
  switchDirectionTarget: number,
  switchDirection: number,
  gameOversCountPerBiomeIndex: { [_: number]: number },

  /*
  algorithm:

  When intersection is in Z step future, altTrackOffset is (0., Z), altTrack is init with a full track already that don't swap. altTrackMode=1.0.

  Then when reached it will be (DX,0) where DX gets accumulated with track & alt track data. It swaps same way data does. altTrackMode=2.0 if play took wrong turn otherwise 1.0 until the altTrack fade away.

  If followAltTrack, camera and cart is offset by altTrackOffset.
  */
  altTrack: Array<Track>, // wrong turn track data
  altTrackMode: number,
  altTrackOffset: vec3, // how many x,y does track starts
  altTrackFailures: number, // number of cart to render for current alt track at the end of altTrack array
  stateAtMouseDown: ?GameState,
  origin: vec3,
  intersectionBiomeEnd: number,
  zoomOut: number,
  worldDelta: vec3,
  terrainOffset: vec3
};
