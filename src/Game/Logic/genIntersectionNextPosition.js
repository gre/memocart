//@flow
// return 0 is i is an intersection position.
// otherwise return the number of step before the next one.
export default function genIntersectionNextPosition(
  i: number,
  seed: number
): number {
  return Math.floor(i / 100) * 100; // FIXME
}
