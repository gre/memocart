import React, { Component } from "react";
import "./index.css";
let Logic = require("./Logic").default;
let { default: Render } = require("./Render");

if (module.hot) {
  module.hot.accept("./Render", () => {
    Render = require("./Render").default;
  });
  module.hot.accept("./Logic", () => {
    Logic = require("./Logic").default;
  });
}

class GameComponent extends Component {
  gameState = Logic.create(0, Math.random());
  getGameState = () => this.gameState;
  action = (name, ...args) => {
    const oldState = this.gameState;
    const newState = Logic[name](oldState, ...args);
    if (newState && newState !== oldState) {
      this.gameState = newState;
      return newState;
    } else {
      return oldState;
    }
  };
  render() {
    const width = 512;
    const height = 512;
    return (
      <Render
        width={width}
        height={height}
        getGameState={this.getGameState}
        action={this.action}
      />
    );
  }
}

export default GameComponent;
