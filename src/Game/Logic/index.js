//@flow
import createFromConfig from "./createFromConfig";
import create from "./create";
import tick from "./tick";

if (process.env.NODE_ENV === "development") {
  require("./genDebug");
}

export default {
  create,
  createFromConfig,
  tick
};
