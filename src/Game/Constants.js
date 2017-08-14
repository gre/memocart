//@flow
import qualityResolver from "./qualityResolver";

// All constants here are both available on JS and GLSL (via a #define)

export const DEV = process.env.NODE_ENV === "development";
export const N_MARCH = qualityResolver({
  // number of raymarch step
  high: 44,
  medium: 40,
  low: 36
});
export const NORMAL_EPSILON = 0.01;
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
let biome = 0;
export const B_COAL = biome++;
export const B_DANG = biome++; // dangerous section. put some wood stick, walls are smaller on top
export const B_DARK = biome++; // dark biome with firefly
export const B_EMPTY = biome++; // generic biome without anything special in it
export const B_FINISH = biome++; // the last tile biome
export const B_FIRE = biome++;
export const B_GOLD = biome++;
export const B_ICY = biome++;
export const B_INTERS = biome++; // biome used for when there is an intersection to take
export const B_PLANT = biome++;
export const B_SAPPHIRE = biome++;
export const B_UFO = biome++;
export const B_VOID = biome++; // complete void, kinda like an intersection but without intersection
export const B_WIRED = biome++; // some past human activity visible. wires, lamps,...

if (biome >= 16) {
  console.warn("BIOME OVERFLOW XD", biome);
}

// Alt Track logic
export const ALTT_OFF = 0; // altTrack is disabled
export const ALTT_CART_ON = 1; // cart is on normal track
export const ALTT_CART_OFF = 2; // cart is on the alt track

export const M_PI = Math.PI;
