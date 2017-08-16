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
  out.gain.value = 1;
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

  playLoop(sounds.scratchMedium);
  sounds.scratchMedium.output.gain.value = 0;

  const brakingNode = playLoop(sounds.braking);
  brakingNode.playbackRate.value = 0.5;
  sounds.braking.output.gain.value = 0;

  const loopMachineNode = playLoop(sounds.loopMachine);
  loopMachineNode.playbackRate.value = 0.5;
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

  playLoop(sounds.intro);
  sounds.intro.output.gain.value = 0;

  playLoop(sounds.dang);
  sounds.dang.output.gain.value = 0;

  playLoop(sounds.dang2);
  sounds.dang2.output.gain.value = 0;

  playLoop(sounds.dang3);
  sounds.dang3.output.gain.value = 0;

  playLoop(sounds.dark2);
  sounds.dark2.output.gain.value = 0;

  playLoop(sounds.coal);
  sounds.coal.output.gain.value = 0;

  playLoop(sounds.cliff2);
  sounds.cliff2.output.gain.value = 0;

  playLoop(sounds.bvoid);
  sounds.bvoid.output.gain.value = 0;

  playLoop(sounds.gold);
  sounds.gold.output.gain.value = 0;

  sounds.dark.gainMult = 1.4;
  sounds.cliff.gainMult = 2;
  sounds.plant.gainMult = 3;
  sounds.loopMachine.gainMult = 2;
  sounds.copper.gainMult = 1.5;
  sounds.fire.gainMult = 1.4;
  sounds.gold.gainMult = 0.6;
  sounds.coal.gainMult = 0.8;

  [sounds.dang, sounds.dang2, sounds.dang3].forEach(d => {
    d.gainMult = 0.2;
  });

  const biomes = {
    [Constants.B_WIRED]: [sounds.loopMachine],
    [Constants.B_UFO]: [sounds.ufo],
    [Constants.B_COPPER]: [sounds.copper],
    [Constants.B_SAPPHIRE]: [sounds.sapphire],
    [Constants.B_PLANT]: [sounds.plant],
    [Constants.B_INTERS]: [sounds.inters],
    [Constants.B_ICY]: [sounds.icy],
    [Constants.B_FIRE]: [sounds.fire],
    [Constants.B_DARK]: [sounds.dark, sounds.dark2],
    [Constants.B_DANG]: [sounds.dang, sounds.dang2, sounds.dang3],
    [Constants.B_CLIFF]: [sounds.cliff, sounds.cliff2],
    [Constants.B_COAL]: [sounds.coal],
    [Constants.B_VOID]: [sounds.bvoid],
    [Constants.B_GOLD]: [sounds.gold]
  };

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
    triggerIntersectionSwitch,
    triggerWin,
    stepIndex,
    home
  }: AudioState) => {
    const applyBiomeProximity = (
      arr: Array<{ output: GainNode, gainMult?: number }>,
      value: number
    ) => {
      arr.forEach(s => {
        s.output.gain.value = 0;
      });
      if (stepIndex <= 0) return;
      if (arr.length === 1) {
        arr[0].output.gain.value = (arr[0].gainMult || 1) * value;
        return;
      }
      const d = stepIndex / 60;
      const p = Math.min(1, (d - Math.floor(d)) * 5); // quickly fades but no strong cut
      const inf = arr[Math.floor(d) % arr.length];
      const sup = arr[Math.floor(d + 1) % arr.length];
      inf.output.gain.value = (inf.gainMult || 1) * value * (1 - p);
      sup.output.gain.value = (sup.gainMult || 1) * value * p;
    };

    out.gain.value = volume;

    sounds.intro.output.gain.value = home ? 0.5 : 0;

    if (!home) {
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

      brakingNode.playbackRate.value = mix(0.5, 1, speed);
      sounds.braking.output.gain.value = 3 * braking * noSpeedCutoff;

      biomesProximity.forEach((value, b) => {
        const audios = biomes[b];
        if (audios) {
          applyBiomeProximity(audios, value);
        }
      });

      sounds.inters.output.gain.value *= noSpeedCutoff;

      if (triggerWin) {
        playNow(sounds.win);
      }
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
    }
  };
}

export default sync;
