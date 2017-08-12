//@flow

const qualityResolver = (map: *) => (q: "high" | "medium" | "low") =>
  q in map ? map[q] : map.default;

export default qualityResolver;
