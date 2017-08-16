//@flow
import type { AudioState } from "../logic/types";
import smoothstep from "smoothstep";
import mix from "../Logic/mix";
import * as Constants from "../Constants";
import audioFiles from "./files";
import SimpleReverb from "./SimpleReverb";

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
  // $FlowFixMe
  const compressor = context.createDynamicsCompressor();
  compressor.connect(context.destination);

  const out = context.createGain();
  out.gain.value = 0.5;
  out.connect(compressor);

  const reverb = new SimpleReverb(context, {
    seconds: 2,
    decay: 1
  });
  out.connect(reverb.input);
  const reverbGain = context.createGain();
  reverbGain.gain.value = 0.5;
  reverbGain.connect(compressor);
  reverb.connect(reverbGain);

  const reverseReverb = new SimpleReverb(context, {
    seconds: 2,
    decay: 1,
    reverse: 1
  });
  reverseReverb.connect(out);

  const soundsOutput = {
    dark: reverseReverb.input
  };

  const sounds = {};
  Object.keys(audioFiles).forEach(name => {
    const output = context.createGain();
    output.connect(soundsOutput[name] || out);
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

  const intersNode = playLoop(sounds.inters);
  intersNode.playbackRate.value = 0.5;
  sounds.inters.output.gain.value = 0;

  const scratchMediumNode = playLoop(sounds.scratchMedium);
  sounds.scratchMedium.output.gain.value = 0;

  const brakingNode = playLoop(sounds.braking);
  brakingNode.playbackRate.value = 0.5;
  sounds.braking.output.gain.value = 0;

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

  playLoop(sounds.ufo);
  sounds.ufo.output.gain.value = 0;
  playLoop(sounds.copper);
  sounds.copper.output.gain.value = 0;
  playLoop(sounds.sapphire);
  sounds.sapphire.output.gain.value = 0;
  playLoop(sounds.plant);
  sounds.plant.output.gain.value = 0;
  playLoop(sounds.icy);
  sounds.icy.output.gain.value = 0;
  playLoop(sounds.fire);
  sounds.fire.output.gain.value = 0;

  const darkNode = playLoop(sounds.dark);
  darkNode.playbackRate.value = 0.7;
  sounds.dark.output.gain.value = 0;

  playLoop(sounds.cliff);
  sounds.cliff.output.gain.value = 0;

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
    out.gain.value = volume * (1 - biomesProximity[Constants.B_FINISH]);

    const noSpeedCutoff = smoothstep(0.0, 0.001, speed);

    windGain.gain.value = 0.2 * smoothstep(0, 2, speed);
    windFilter.frequency.value = mix(0, 2000, speed);

    loopCartNormalNode.playbackRate.value = mix(0.4, 1.4, speed);
    sounds.loopCartNormal.output.gain.value =
      mix(
        Math.min(1, descentShake + turnShake),
        smoothstep(0, 0.2, speed),
        0.2
      ) * noSpeedCutoff;

    loopCartHighNode.playbackRate.value =
      mix(0.8, 1.2, smoothstep(0.5, 1, speed)) * noSpeedCutoff;
    sounds.loopCartHigh.output.gain.value =
      descentShake * descentShake * noSpeedCutoff;

    sounds.scratchMedium.output.gain.value =
      turnShake * turnShake * noSpeedCutoff;

    loopMachineNode.playbackRate.value = 0.5;
    sounds.loopMachine.output.gain.value = biomesProximity[Constants.B_WIRED];

    brakingNode.playbackRate.value = mix(0.5, 1, speed);
    sounds.braking.output.gain.value = 3 * braking * noSpeedCutoff;

    sounds.ufo.output.gain.value = biomesProximity[Constants.B_UFO];
    sounds.copper.output.gain.value = biomesProximity[Constants.B_COPPER];
    sounds.sapphire.output.gain.value = biomesProximity[Constants.B_SAPPHIRE];
    sounds.plant.output.gain.value = biomesProximity[Constants.B_PLANT];
    sounds.inters.output.gain.value =
      biomesProximity[Constants.B_INTERS] * noSpeedCutoff;
    sounds.icy.output.gain.value = biomesProximity[Constants.B_ICY];
    sounds.fire.output.gain.value = biomesProximity[Constants.B_FIRE];
    sounds.dark.output.gain.value = 1.4 * biomesProximity[Constants.B_DARK];
    sounds.cliff.output.gain.value = 2 * biomesProximity[Constants.B_CLIFF];

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
