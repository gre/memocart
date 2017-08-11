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

class GameComponent extends Component {
  state = {
    loaded: false
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
    if (!this.state.loaded) {
      Promise.all([
        delay(500),
        Promise.race([
          new FontFaceObserver("MinimalPixels").load(),
          delay(3000)
        ])
      ])
        .catch(() => {
          console.log("Font Problem");
        })
        .then(() => {
          this.setState({ loaded: true });
        });
    }
  }
  render() {
    const { lowQuality } = this.props;
    const width = 512;
    const height = 512;
    return (
      <div className="game" style={{ width, height }}>
        {!this.state.loaded
          ? <div>
              Loading...
              <footer>
                if it never loads, try <a href="/?lowQuality">/?lowQuality</a>
              </footer>
            </div>
          : <Render
              width={width}
              height={height}
              getGameState={this.getGameState}
              action={this.action}
              lowQuality={lowQuality}
            />}
      </div>
    );
  }
}

export default GameComponent;
