//@flow
import FontFaceObserver from "fontfaceobserver";
import React, { Component } from "react";
import { DEV } from "./Constants";
import * as Debug from "../Debug";
import "./index.css";
let Logic = require("./Logic").default;
let { default: Render } = require("./Render");

if (module.hot) {
  // $FlowFixMe
  module.hot.accept("./Render", () => {
    Render = require("./Render").default;
  });
  // $FlowFixMe
  module.hot.accept("./Logic", () => {
    Logic = require("./Logic").default;
  });
}

const globalSeed = Math.random();
console.log("seed", globalSeed);

class GameComponent extends Component {
  state = {
    fontLoaded: !DEV
  };
  gameState = Logic.create(-1, globalSeed);
  getGameState = () => this.gameState;
  action = (name: string, ...args: *) => {
    const oldState = this.gameState;
    const newState = Logic[name](oldState, ...args);
    if (newState && newState !== oldState) {
      if (DEV) {
        Debug.setEditable("stepIndex", newState.stepIndex);
      }
      this.gameState = newState;
      return newState;
    } else {
      return oldState;
    }
  };
  componentDidMount() {
    if (DEV) {
      Debug.defineEditable("level", this.gameState.level, level => {
        if (typeof level === "number") {
          this.gameState = Logic.create(level, globalSeed);
        }
      });
      Debug.defineEditable(
        "stepIndex",
        this.gameState.stepIndex,
        (stepIndex: number) => {
          this.gameState = { ...this.gameState, stepIndex };
        }
      );
    }
    if (!this.state.fontLoaded) {
      new FontFaceObserver("MinimalPixels")
        .load()
        .catch(() => {
          console.log("Font Problem");
        })
        .then(() => {
          this.setState({ fontLoaded: true });
        });
    }
  }
  render() {
    const width = 512;
    const height = 512;
    return (
      <div className="game" style={{ width, height }}>
        {!this.state.fontLoaded
          ? <div>Loading...</div>
          : <Render
              width={width}
              height={height}
              getGameState={this.getGameState}
              action={this.action}
            />}
      </div>
    );
  }
}

export default GameComponent;
