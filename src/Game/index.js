//@flow
import FontFaceObserver from "fontfaceobserver";
import React, { Component } from "react";
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
window.globalSeed = globalSeed;
console.log("MEMO CART seed:", globalSeed);

new FontFaceObserver("MinimalPixels").load().catch(() => {
  console.error("Font Loading Problem");
});

class GameComponent extends Component {
  state = {
    wait: this.props.quality ? -1 : 30
  };
  gameState = null;
  getGameState = () => this.gameState;
  action = (name: string, ...args: *) => {
    const { gameState } = this;
    if (!gameState) return;
    const oldState = gameState;
    const newState = Logic[name](oldState, ...args);
    if (newState && newState !== oldState) {
      this.gameState = newState;
      return newState;
    } else {
      return oldState;
    }
  };
  componentDidMount() {
    if (this.props.quality) {
      this.gameState = Logic.create(-1, globalSeed, this.props.quality);
    }
    const loop = () => {
      let { wait } = this.state;
      if (wait <= 0) return;
      setTimeout(loop, 1000);
      wait--;
      if (wait === 0) {
        this.gameState = Logic.create(-1, globalSeed, "high");
      }
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
    const screen = typeof window.screen === "object" ? window.screen : null;
    const maxWidth = screen ? Math.min(screen.width, screen.height) : Infinity;
    const width = Math.min(512, maxWidth);
    const height = width;
    return (
      <div className="game" style={{ width, height }}>
        {wait
          ? wait > 0
            ? <div title="(shader compilation holds on some computers. If so, try lower
            quality)">
                quality?
                <div className="qualities">
                  <a href="?quality=high">HIGH</a>
                  <a href="?quality=medium">MEDIUM</a>
                  <a href="?quality=low">LOW</a>
                </div>
                <div className="auto">autostart in {wait}...</div>
              </div>
            : <div>
                Loading...
                <footer>
                  if it never loads, try <a href="?quality=low">quality=low</a>
                </footer>
              </div>
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
