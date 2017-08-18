//@flow
import env from "../env";
import type { Config } from "./Config";

const getExtraParams = () => {
  return {
    userAgent: navigator.userAgent,
    href: window.location.href
  };
};

export const sendSuccess = (config: Config, stats: *) =>
  fetch(env.highscoresAPI + "/stats/success", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getExtraParams(), config, stats })
  }).then(res => res.json());

export const sendFailure = (config: Config, error: string) =>
  fetch(env.highscoresAPI + "/stats/failure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getExtraParams(), config, error })
  }).then(res => res.json());
