//@flow

export type vec3 = [number, number, number];

export type UserEvents = {
  keys: { [_: number]: number },
  keyRightDelta: number,
  keyUpDelta: number,
  spacePressed: number,
  mouseDown: [number, number],
  mouseAt: [number, number]
};

export type Biome = {
  biomeSeed: number,
  type: number
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
  titleCentered?: boolean,
  footerCentered?: boolean,
  footerBlink?: boolean
};

export type GameState = {
  uiState: ?UIState,
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
  seed: number,
  level: number,
  speed: number, // z-unit per second
  acc: number,
  braking: number, // braking factor
  switchDirectionTarget: number,
  switchDirection: number,
  altTrack: Array<Track>, // wrong turn track data
  altTrackMode: number,
  altTrackOffset: vec3, // how many x,y does track starts
  stateAtMouseDown: ?GameState,
  origin: vec3,
  intersectionBiomeEnd: number,
  zoomOut: number
};
