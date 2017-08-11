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

const delay = ms => new Promise(success => setTimeout(success, ms));

const globalSeed = Math.random();
console.log("seed", globalSeed);

const fontLoad = new FontFaceObserver("MinimalPixels").load().catch(() => {
  console.error("Font Loading Problem");
});

class GameComponent extends Component {
  state = {
    wait: this.props.quality ? -1 : 30
  };
  gameState = Logic.create(-1, globalSeed);
  getGameState = () => this.gameState;
  action = (name: string, ...args: *) => {
    const oldState = this.gameState;
    const newState = Logic[name](oldState, ...args);
    if (newState && newState !== oldState) {
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
    }
    const loop = () => {
      let { wait } = this.state;
      if (wait <= 0) return;
      setTimeout(loop, 1000);
      wait--;
      this.setState({ wait });
    };
    if (this.state.wait === -1) {
      // wait a bit so we actually render the "Loading..." as main thread might block (webgl)
      setTimeout(() => {
        this.setState({ wait: 0 });
      }, 500);
    } else {
      // otherwise we countdown
      setTimeout(loop, 1000);
    }
  }
  render() {
    const { wait } = this.state;
    const { quality } = this.props;
    const width = 512;
    const height = 512;
    return (
      <div className="game" style={{ width, height }}>
        {wait
          ? wait > 0
            ? <div>
                quality?
                <div className="qualities">
                  <a href="?quality=high">HIGH</a>
                  <a href="?quality=medium">MEDIUM</a>
                  <a href="?quality=low">LOW</a>
                </div>
                <div>autostart in {wait}...</div>
                <footer>
                  (Unfortunately, shader compilation might takes forever on some
                  computers. If it never loads in HIGH, try a lower quality 😭)
                </footer>
              </div>
            : <div>
                Loading...
                <footer>
                  if it never loads, try <a href="?quality=low">low</a> quality
                </footer>
              </div>
          : <Render
              width={width}
              height={height}
              getGameState={this.getGameState}
              action={this.action}
              quality={quality}
            />}
      </div>
    );
  }
}

export default GameComponent;
