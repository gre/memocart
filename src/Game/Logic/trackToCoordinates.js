//@flow
import { TURN_DX, DESCENT_DY } from "../Constants";
export default (
  track: Array<*>,
  initialPosition: [number, number, number] = [0, 0, 0]
): Array<[number, number, number]> =>
  track.reduce(
    (positions, track) => {
      const last = positions[positions.length - 1];
      return [
        ...positions,
        [
          last[0] + TURN_DX * track.turn,
          last[1] + DESCENT_DY * track.descent,
          last[2] + 1
        ]
      ];
    },
    [initialPosition]
  );
