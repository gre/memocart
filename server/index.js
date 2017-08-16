//@flow
const { MongoClient } = require("mongodb");
const env = require("./env");

const promisify = (f, ctx = null) => (...args) =>
  new Promise((success, failure) => {
    f.call(ctx, ...args, (err, data) => {
      if (err) failure(err);
      else success(data);
    });
  });

const connectMongo = promisify(MongoClient.connect);
const scores = () =>
  connectMongo(env.MONGO).then(db => db.collection("scores"));

scores().then(coll => promisify(coll.count, coll)()).then(count => {
  console.log(count + " scores");
});

const fetchScores = seed =>
  scores().then(coll => {
    const q = coll
      .find(
        {
          seed
        },
        { fields: { username: 1, level: 1 } }
      )
      .sort({
        level: -1
      })
      .limit(5);
    return promisify(q.toArray, q)();
  });

const recordScore = doc =>
  scores().then(coll => {
    return promisify(coll.replaceOne, coll)(
      {
        seed: doc.seed,
        username: doc.username
      },
      doc,
      { upsert: true }
    );
  });

const app = require("express")();
app.use(require("body-parser").json());
app.use(require("cors")());

app.get("/favicon.ico", (req, res) => {
  res.status(404).send();
});
app.get("/", (req, res) => {
  res.send("Hi There");
});

app.get("/scores/:seed", (req, res) => {
  // Retrieve the scores of a given seed
  fetchScores(req.params.seed)
    .then(json =>
      res.json(json.map(({ username, level }) => ({ username, level })))
    )
    .catch(e => {
      console.error(e);
      res.status(500).send();
    });
});

app.post("/", (req, res) => {
  // a GameState is sent to server
  Promise.resolve(req.body)
    .then(body => {
      const { username, levelReached, seed } = body.gameState;
      console.log("Receive", username, levelReached, seed);
      if (typeof levelReached !== "number" || levelReached <= 0)
        throw new Error("invalid levelReached=" + levelReached);
      if (typeof seed !== "string" || !seed)
        throw new Error("invalid seed=" + seed);
      if (
        typeof username !== "string" ||
        !username ||
        !username.match(/[a-zA-Z0-9]{3,8}/)
      )
        throw new Error("invalid username=" + username);
      return { username, level: levelReached, seed, date: Date.now() };
    })
    .then(recordScore)
    .then(result => {
      const { username, levelReached, seed } = req.body.gameState;
      console.log(
        result,
        " @" + seed + " lvl " + levelReached + " by " + username
      );
      return res.json({ inserted: true });
    })
    .catch(e => {
      console.error(e);
      res.status(500).send();
    });
});

app.listen(env.PORT, function() {
  console.log("listening on http://localhost:" + env.PORT);
});
