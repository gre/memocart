//@flow
export const DEV = process.env.NODE_ENV === "development";
export const N_MARCH = 40; // number of raymarch step
export const TRACK_SIZE = 8; // number of tracks. we can reduce to 6 to gain some FPS..?
export const DESCENT_DY = -0.6; // the maximum possible descent
export const TURN_DX = 0.7; // the range of turn (scaled on [-0.5, +0.5] interval)

export const STATUS_RUNNING = 0;
export const STATUS_FINISHED = 1;
export const STATUS_GAMEOVER = 2;

// B_ constants are the biomes
export const B_INTERS = 0; // biome used for when there is an intersection to take
export const B_EMPTY = 1; // generic biome without anything special in it
export const B_DARK = 2; // dark biome with firefly
export const B_FINISH = 15; // the last tile biome

// Alt Track logic
export const ALTT_OFF = 0; // altTrack is disabled
export const ALTT_CART_ON = 1; // cart is on normal track
export const ALTT_CART_OFF = 2; // cart is on the alt track
