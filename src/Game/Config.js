// @flow

export type Config = {
  quality: "low" | "medium" | "high",
  seed?: string,
  username: string,
  mode: "random" | "daily"
};

const acceptMode = m => m === "random" || m === "daily";
const acceptQuality = q => q === "high" || q === "medium" || q === "low";

export const validate = (
  config: Object
): { data: ?Config, errors: Array<{ id: string, message: string }> } => {
  const errors = [];
  if (
    !config.quality ||
    typeof config.quality !== "string" ||
    !acceptQuality(config.quality)
  ) {
    errors.push({ id: "quality", message: "Please select a game quality" });
  }
  if (
    !config.mode ||
    typeof config.mode !== "string" ||
    !acceptMode(config.mode)
  ) {
    errors.push({ id: "mode", message: "Please select a game mode" });
  }
  if (!config.username || typeof config.username !== "string") {
    errors.push({ id: "username", message: "Please input a username" });
  } else if (!config.username.match(/[a-zA-Z0-9]{3,8}/)) {
    errors.push({
      id: "username",
      message: "username is 3-8 alphanum characters"
    });
  }
  if (errors.length === 0) {
    return { data: config, errors };
  } else {
    return { data: null, errors };
  }
};

export const retrieveLocalStorage = (): ?Config => {
  try {
    const item = localStorage.getItem("config");
    if (!item) return null;
    const res = validate(JSON.parse(item));
    if (res.data) {
      const { ...data } = res.data;
      delete data.seed;
      return data;
    }
  } catch (e) {}
};

export const saveLocalStorage = (config: Config) => {
  localStorage.setItem("config", JSON.stringify(config));
};

export const getDailySeed = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};
