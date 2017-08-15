//@flow
import type { GameState, UserEvents, UIState } from "./types";
import { ALTT_CART_OFF, ALTT_CART_ON } from "../Constants";
import levelUp from "./levelUp";
import { spaceToSkip, pressRight, holdSpace } from "./messages";

type Cond = (g: GameState, userEvents: UserEvents) => boolean;
type Tick = (g: GameState, userEvents: UserEvents) => GameState;
type TutorialLogic = {
  condition: Cond,
  steps: Array<{
    uiState: UIState,
    conditionSkip: Cond,
    conditionLeave: Cond,
    conditionEnter: Cond,
    tick: Tick
  }>
};

// condition logics

const or = (...conds: Array<Cond>): Cond => (g, userEvents) =>
  conds.some(c => c(g, userEvents));
const and = (...conds: Array<Cond>): Cond => (g, userEvents) =>
  conds.every(c => c(g, userEvents));
//const not = (cond: Cond): Cond => (g, userEvents) => !cond(g, userEvents);
const always: Cond = () => true;
const never: Cond = () => false;

//const spacePressed: Cond = (g, userEvents) => !!userEvents.spacePressed;
const rightPressed: Cond = (g, userEvents) => userEvents.keyRightDelta === 1;
const beforeStepIndex = (index: number): Cond => g => g.stepIndex > index;
const afterStepIndex = (index: number): Cond => g => g.stepIndex < index;
const cartOffAltTrack: Cond = g => g.altTrackMode === ALTT_CART_OFF;
const cartOnAltTrack: Cond = g => g.altTrackMode === ALTT_CART_ON;
const successfulTurn: Cond = and(afterStepIndex(39), cartOffAltTrack);

// tick logics
const tickStop: Tick = g => ({ ...g, speed: 0 });
const tickNoop: Tick = g => g;
const tickSlowDown: Tick = g => ({
  ...g,
  speed: g.speed + (1 - g.speed) * 0.01,
  acc: g.acc - g.acc * 0.01
});

const tutVersion = "1";
const tutorialFinishedOnce = () =>
  localStorage.getItem("tutorialFinished") === tutVersion;
const setTutorialFinishedOnce = () =>
  localStorage.setItem("tutorialFinished", tutVersion);

const tutorialLogic: TutorialLogic = {
  condition: g => g.level === 0,
  steps: [
    {
      uiState: {
        title: "Tutorial"
      },
      conditionSkip: never,
      conditionEnter: always,
      tick: tickNoop,
      conditionLeave: g => g.time - g.startTime > 0.2
    },
    {
      uiState: {
        title: "Tutorial",
        footer: !tutorialFinishedOnce() ? "" : spaceToSkip(),
        footerCentered: true,
        footerBlink: true
      },
      conditionSkip: never,
      conditionEnter: always,
      tick: !tutorialFinishedOnce()
        ? tickNoop
        : (g, userEvents) => {
            if (userEvents.spacePressed) {
              return levelUp(g);
            }
            return g;
          },
      conditionLeave: afterStepIndex(60)
    },
    {
      uiState: {
        title: "incoming\nINTERSECTION!",
        body: "Let's go... RIGHT!"
      },
      conditionSkip: never,
      conditionEnter: afterStepIndex(60),
      tick: tickNoop,
      conditionLeave: afterStepIndex(50)
    },
    {
      uiState: {
        title: "INTERSECTION!",
        body: "Let's go... RIGHT!",
        footerBlink: true,
        footerCentered: true,
        footer: pressRight()
      },
      conditionSkip: cartOnAltTrack,
      conditionEnter: afterStepIndex(50),
      tick: tickStop,
      conditionLeave: rightPressed
    },
    {
      uiState: {
        title: "Wrong turn!",
        body: "Let's remember\nfor next run!"
      },
      conditionSkip: or(beforeStepIndex(50), successfulTurn),
      conditionEnter: afterStepIndex(38),
      tick: tickNoop,
      conditionLeave: beforeStepIndex(38)
    },
    {
      uiState: {
        title: "Remember",
        body: "to go LEFT!"
      },
      conditionSkip: successfulTurn,
      conditionEnter: and(afterStepIndex(60), beforeStepIndex(40)),
      tick: tickNoop,
      conditionLeave: afterStepIndex(40)
    },
    {
      uiState: {
        title: "Good Job!",
        body: "ProTip:\n" + holdSpace() + "\nto   brake"
      },
      conditionSkip: never,
      conditionEnter: afterStepIndex(34),
      tick: tickSlowDown,
      conditionLeave: afterStepIndex(16)
    },
    {
      uiState: {
        title: "Mine Escaped!",
        black: true,
        body: "Game will start.\nSame map but...\nfrom higher!",
        footer: "Get Prepared..."
      },
      conditionSkip: never,
      conditionEnter: afterStepIndex(16),
      tick: (g, userEvents) => {
        setTutorialFinishedOnce();
        return tickSlowDown(g, userEvents);
      },
      conditionLeave: afterStepIndex(1)
    }
  ]
};

export default tutorialLogic;
