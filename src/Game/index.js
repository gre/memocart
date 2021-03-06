//@flow
import FontFaceObserver from "fontfaceobserver";
import React, { Component } from "react";
import Audio from "./Audio";
import "./index.css";
import * as Conf from "./Config";
import type { Config } from "./Config";
import * as HighScores from "./HighScores";
import * as Stats from "./Stats";
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

new FontFaceObserver("MinimalPixels").load().catch(() => {
  console.error("Font Loading Problem");
});

class Field extends Component {
  render() {
    const { name, label, help, children } = this.props;
    return (
      <label className="field" title={help} name={name}>
        <span>
          {label}
        </span>
        {children}
      </label>
    );
  }
}

class Button extends Component {
  onClick = e => {
    e.preventDefault();
    this.props.onClick();
  };
  onKeyPress = e => {
    if (e.which === 32) {
      this.onClick(e);
    }
  };
  render() {
    const { disabled, onClick, color, background, children } = this.props;
    return (
      <a
        href="#"
        onClick={!onClick || disabled ? null : this.onClick}
        onKeyPress={this.onKeyPress}
        style={{ color, background, opacity: disabled ? 0.5 : 1 }}
        className="button"
      >
        {children}
      </a>
    );
  }
}

class Select extends Component {
  render() {
    const { value, onChange, values } = this.props;
    return (
      <div className="select">
        {values.map(({ value: v, label, color }) =>
          <Button
            key={v}
            color={value === v ? "#000" : color}
            background={value === v ? color : "#000"}
            onClick={() => {
              //$FlowFixMe
              onChange(v);
            }}
          >
            {label}
          </Button>
        )}
      </div>
      /*
      <select value={value} onChange={onChange}>
        {values.map(({ value, label }) =>
          <option value={value}>
            {label}
          </option>
        )}
      </select>
      */
    );
  }
}

const qualities = [
  { value: "low", label: "LOW", color: "#F64" },
  { value: "medium", label: "MED", color: "#09F" },
  { value: "high", label: "HIGH", color: "#0F9" }
];
const modes = [
  { value: "daily", label: "Daily", color: "#fff" },
  { value: "random", label: "Random", color: "#fff" }
];

const highscoresTest = HighScores.test();

class GameComponent extends Component {
  state: {
    config: Config,
    loading: boolean,
    gameContextTitle: string,
    highscores: ?Array<{ level: number, username: string }>,
    highscoresServerAccessible: ?boolean
  } = {
    config: {
      quality: "high",
      mode: "daily",
      username: "",
      ...Conf.retrieveLocalStorage(),
      ...this.props.query // override any field with url
    },
    loading: false,
    gameContextTitle: "",
    highscores: null,
    highscoresServerAccessible: null
  };
  componentWillMount() {
    Promise.race([
      highscoresTest,
      new Promise(success => setTimeout(success, 3000, "timeout"))
    ])
      .then(r => {
        this.setState({ highscoresServerAccessible: r.success === true });
      })
      .catch(e => {
        this.setState({ highscoresServerAccessible: false });
      });
  }

  gameState = null;
  getGameState = () => this.gameState;
  action = (name: string, ...args: *) => {
    const { gameState: oldState } = this;
    if (!oldState) return;
    const newState = Logic[name](oldState, ...args);
    if (newState && newState !== oldState) {
      if (
        newState.levelReached > 1 &&
        newState.levelReached !== oldState.levelReached
      ) {
        HighScores.send(newState).then(({ inserted }) => {
          if (inserted) {
            this.syncHighscores(newState.seed);
          }
        });
      }
      this.setGameState(newState);
      return newState;
    } else {
      return oldState;
    }
  };
  setGameState(g) {
    this.gameState = g;
    Audio(g.audioState);
  }
  syncHighscores = (seed: string) => {
    HighScores.retrieve(seed)
      .then(highscores => {
        this.setState({ highscores });
      })
      .catch(e => {
        console.log("Failed to sync the highscores: ", e);
      });
  };
  start = () => {
    const { ...config } = this.state.config;
    let gameContextTitle;
    if (config.mode === "daily") {
      config.seed = Conf.getDailySeed();
      gameContextTitle = "Mine " + config.seed;
    } else {
      config.seed = Math.random().toString(16).slice(2, 4);
      gameContextTitle = "You're in 'MINE " + config.seed + "'";
    }
    Conf.saveLocalStorage(config);
    if (config.seed) this.syncHighscores(config.seed);
    this.setState({ config, loading: true, gameContextTitle }, () => {
      setTimeout(() => {
        this.setGameState(Logic.createFromConfig(config));
        this.setState({ loading: false });
      }, 500);
    });
  };
  onUserNameChange = (e: *) => {
    this.setState({
      config: { ...this.state.config, username: e.target.value }
    });
  };
  onQualitySelectChange = (quality: "low" | "medium" | "high") => {
    this.setState({
      config: {
        ...this.state.config,
        quality
      }
    });
  };
  onModeChange = (mode: "random" | "daily") => {
    this.setState({
      config: {
        ...this.state.config,
        mode
      }
    });
  };
  onGLFailure = (errorMessage: string) => {
    Stats.sendFailure(this.state.config, errorMessage);
    this.gameState = null;
    this.forceUpdate();
    if (process.env.NODE_ENV === "production") alert(errorMessage);
  };
  onSuccessStart = (stats: *) => {
    Stats.sendSuccess(this.state.config, stats);
  };
  render() {
    const {
      config,
      highscores,
      gameContextTitle,
      highscoresServerAccessible,
      loading
    } = this.state;
    const { gameState } = this;
    const screen = typeof window.screen === "object" ? window.screen : null;
    const maxWidth = screen ? Math.min(screen.width, screen.height) : Infinity;
    const width = Math.min(512, maxWidth);
    const height = width;

    let body;
    if (loading) {
      body = (
        <div>
          Loading...
          {config.quality !== "low"
            ? <footer>
                if it never loads, try <a href="?quality=low">quality=low</a>
              </footer>
            : null}
        </div>
      );
    } else if (gameState) {
      body = (
        <Render
          width={width}
          height={height}
          getGameState={this.getGameState}
          action={this.action}
          gameContext={{ highscores, title: gameContextTitle }}
          onGLFailure={this.onGLFailure}
          onSuccessStart={this.onSuccessStart}
        />
      );
    } else {
      const validation = Conf.validate(config);
      body = (
        <div className="menu">
          <Field label="username:" name="username" help="for saving highscores">
            <input
              type="text"
              onChange={this.onUserNameChange}
              value={config.username}
              maxLength={8}
              autoFocus={!config.username}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="off"
            />
          </Field>
          <Field
            label="quality:"
            name="quality"
            help="(shader compilation holds on some computers. If so, try lower
      quality)"
          >
            <Select
              onChange={this.onQualitySelectChange}
              value={config.quality}
              values={qualities}
            />
          </Field>
          <Field label="mine:" name="quality">
            <Select
              onChange={this.onModeChange}
              value={config.mode}
              values={modes}
            />
          </Field>
          <div className="buttons">
            <Button
              disabled={validation.errors.length !== 0}
              onClick={this.start}
            >
              START
            </Button>
          </div>
          <div className="errors">
            {validation.errors.map(v =>
              <p key={v.id}>
                {v.message}
              </p>
            )}
            {highscoresServerAccessible === false
              ? <p>WARNING the HighScores server is not currently reachable</p>
              : null}
          </div>
        </div>
      );
    }
    return (
      <div className="game" style={{ width, minHeight: height }}>
        {body}
      </div>
    );
  }
}

export default GameComponent;
