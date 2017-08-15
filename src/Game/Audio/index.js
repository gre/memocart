//@flow
import type { AudioState } from "../logic/types";
import smoothstep from "smoothstep";
import mix from "../Logic/mix";
import * as Constants from "../Constants";

import cartAccidentLight from "./fx/cart-accident-light.m4a";
import cartAccident from "./fx/cart-accident.m4a";
import intersectionPass from "./fx/intersection-pass.m4a";
import loopCartHigh from "./fx/loop-cart-high.m4a";
import loopCartNormal from "./fx/loop-cart-normal.m4a";
import loopDrift1 from "./fx/loop-drift1.m4a";
import loopDrift2 from "./fx/loop-drift2.m4a";
import loopMachine from "./fx/loop-machine.m4a";
import scratchHard from "./fx/scratch-hard.m4a";
import scratchLight from "./fx/scratch-light.m4a";
import scratchMedium from "./fx/scratch-medium.m4a";
import switch1 from "./fx/switch1.m4a";
import switch2 from "./fx/switch2.m4a";
import switch3 from "./fx/switch3.m4a";

const audioFiles = {
  cartAccidentLight,
  cartAccident,
  intersectionPass,
  loopCartHigh,
  loopCartNormal,
  loopDrift1,
  loopDrift2,
  loopMachine,
  scratchHard,
  scratchLight,
  scratchMedium,
  switch1,
  switch2,
  switch3
};

const context = new AudioContext();

const loadSound = (url: string): Promise<AudioBuffer> =>
  new Promise((success, failure) => {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.onload = () => {
      context.decodeAudioData(request.response, success, failure);
    };
    request.send();
  });

const playLoop = ({ bufferPromise, output }) => {
  const source = context.createBufferSource();
  source.loop = true;
  source.connect(output);
  bufferPromise.then(buffer => {
    source.buffer = buffer;
    source.start(0);
  });
  return source;
};

const playNow = ({ buffer, output }) => {
  if (buffer) {
    const source = context.createBufferSource();
    source.connect(output);
    source.buffer = buffer;
    source.start(0);
    setTimeout(() => {
      source.disconnect(output);
    }, 1000 * (buffer.duration + 1));
  }
};

let sync;
if (!context) {
  sync = (g: AudioState) => {};
} else {
  const out = context.createGain();
  out.gain.value = 0.5;
  // $FlowFixMe
  const compressor = context.createDynamicsCompressor();
  out.connect(compressor);
  compressor.connect(context.destination);

  const sounds = {};
  Object.keys(audioFiles).forEach(name => {
    const bufferSource = context.createBufferSource();
    const output = context.createGain();
    output.connect(out);
    const bufferPromise = loadSound(audioFiles[name]);
    const sound: { output: *, bufferPromise: *, buffer: ?AudioBuffer } = {
      output,
      bufferPromise,
      buffer: null
    };
    sounds[name] = sound;
    bufferPromise.then(
      buffer => {
        sound.buffer = buffer;
      },
      err => {
        console.warn("Can't load sound " + name);
      }
    );
  });

  const switchSounds = [sounds.switch1, sounds.switch2, sounds.switch3];

  const scratchLightNode = playLoop(sounds.scratchLight);
  scratchLightNode.playbackRate.value = 0.5;
  sounds.scratchLight.output.gain.value = 0;

  const scratchMediumNode = playLoop(sounds.scratchMedium);
  sounds.scratchMedium.output.gain.value = 0;

  const scratchHardNode = playLoop(sounds.scratchHard);
  scratchHardNode.playbackRate.value = 0.5;
  sounds.scratchHard.output.gain.value = 0;

  const loopMachineNode = playLoop(sounds.loopMachine);
  sounds.loopMachine.output.gain.value = 0;

  const loopCartNormalNode = playLoop(sounds.loopCartNormal);
  sounds.loopCartNormal.output.gain.value = 0;

  const loopCartHighNode = playLoop(sounds.loopCartHigh);
  sounds.loopCartHigh.output.gain.value = 0;

  const windFilter = context.createBiquadFilter();
  windFilter.Q.value = 0.2;
  windFilter.connect(out);
  const windGain = context.createGain();
  windGain.gain.value = 0;
  windGain.connect(windFilter);
  loopCartHighNode.connect(windGain);

  let previousTurn = 0,
    previousDescent = 0;

  sync = ({
    volume,
    speed,
    turnShake,
    descentShake,
    biomesProximity,
    triggerSwitchChange,
    braking,
    triggerCartAccident,
    triggerLightCartAccident,
    triggerIntersectionSwitch
  }: AudioState) => {
    out.gain.value = volume;

    windGain.gain.value = 0.2 * smoothstep(0, 2, speed);
    windFilter.frequency.value = mix(0, 2000, speed);

    loopCartNormalNode.playbackRate.value = mix(0.4, 1.4, speed);
    sounds.loopCartNormal.output.gain.value = mix(
      Math.min(1, descentShake + turnShake),
      smoothstep(0, 0.2, speed),
      0.2
    );

    loopCartHighNode.playbackRate.value = mix(
      0.8,
      1.2,
      smoothstep(0.5, 1, speed)
    );
    sounds.loopCartHigh.output.gain.value = descentShake * descentShake;

    sounds.scratchMedium.output.gain.value = turnShake * turnShake;

    loopMachineNode.playbackRate.value = 0.5;
    sounds.loopMachine.output.gain.value = biomesProximity[Constants.B_WIRED];

    sounds.scratchLight.output.gain.value = biomesProximity[Constants.B_INTERS];

    scratchHardNode.playbackRate.value = mix(0.5, 1, speed);
    sounds.scratchHard.output.gain.value = 3 * braking; // FIXME make a more dedicated "braking" sound

    if (triggerSwitchChange) {
      const switchSound =
        switchSounds[Math.floor(Math.random() * switchSounds.length)];
      playNow(switchSound);
    }
    if (triggerIntersectionSwitch) {
      playNow(sounds.intersectionPass);
    }
    if (triggerCartAccident) {
      playNow(sounds.cartAccident); // rename cartAccidentInCarts
    }
    if (triggerLightCartAccident) {
      playNow(sounds.cartAccidentLight); // FIXME improve the sound and rename to cartAccidentInWall
    }
  };
}

export default sync;
