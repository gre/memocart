//@flow
import qualityResolver from "./qualityResolver";

export const DEV = process.env.NODE_ENV === "development";
export const N_MARCH = qualityResolver({
  // number of raymarch step
  high: 44,
  medium: 40,
  low: 36
});
export const TRACK_SIZE = qualityResolver({
  // number of tracks.
  high: 12,
  medium: 10,
  low: 8
});
export const DESCENT_DY = -0.8; // the maximum possible descent
export const TURN_DX = 0.7; // the range of turn (scaled on [-0.5, +0.5] interval)

export const STATUS_RUNNING = 0;
export const STATUS_FINISHED = 1;
export const STATUS_GAMEOVER = 2;

// B_ constants are the biomes
export const B_INTERS = 0; // biome used for when there is an intersection to take
export const B_EMPTY = 1; // generic biome without anything special in it
export const B_DARK = 2; // dark biome with firefly
export const B_GOLD = 3;
export const B_WIRED = 4; // some past human activity visible. wires, lamps,...
export const B_DANG = 5; // dangerous section. put some wood stick, walls are smaller on top
export const B_SAPPHIRE = 6;
export const B_FIRE = 7;
export const B_COAL = 8;
export const B_PLANT = 9;
export const B_UFO = 10;
export const B_VOID = 11; // complete void, kinda like an intersection but without intersection
export const B_FINISH = 15; // the last tile biome

// Alt Track logic
export const ALTT_OFF = 0; // altTrack is disabled
export const ALTT_CART_ON = 1; // cart is on normal track
export const ALTT_CART_OFF = 2; // cart is on the alt track

export const M_PI = Math.PI;
