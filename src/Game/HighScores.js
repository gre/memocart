//@flow
import env from "../env";
import type { GameState } from "./Logic/types";

export const retrieve = (seed: string) =>
  fetch(env.highscoresAPI + "/scores/" + seed).then(res => res.json());

export const send = (gameState: GameState): Promise<{ inserted: boolean }> =>
  fetch(env.highscoresAPI + "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameState })
  }).then(res => res.json());

export const test = () =>
  fetch(env.highscoresAPI + "/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ everything: 42 })
  }).then(res => res.json());
