// node timelapse-dedup.js | while read f; do echo mv $f dups; done
const limit = 30 * 1000;

const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "./timelapse");

const all = fs
  .readdirSync(dir)
  .map(file => {
    const date = new Date(
      file.replace(/[@]/g, " ").replace(/[hm]/g, ":").replace(/[.]jpg$/g, "")
    );
    return { file, date, millis: date.getTime() };
  })
  .sort((a, b) => a.millis - b.millis)
  .reduce(
    ([prevDateTime, coll], item) => {
      const diff = item.millis - prevDateTime;
      if (!isNaN(diff) && diff < limit) {
        return [prevDateTime, coll.concat(item)];
      } else {
        return [item.millis, coll];
      }
    },
    [0, []]
  )[1]
  .map(item => item.file);

if (all.length > 0) {
  console.log(all.map(file => path.join(dir, file)).join("\n"));
}
