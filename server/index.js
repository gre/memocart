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
const stats = () => connectMongo(env.MONGO).then(db => db.collection("stats"));

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

const fetchStats = () =>
  stats().then(coll => {
    const q = coll.find();
    return promisify(q.toArray, q)();
  });

const recordStats = doc =>
  stats().then(coll => {
    return promisify(coll.insertOne, coll)(doc);
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

app.post("/test", (req, res) => {
  try {
    if (req.body.everything === 42) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (e) {
    res.json({ success: false });
  }
});

function checkValidStat(body) {
  if (!body || typeof body !== "object") {
    throw new Error("invalid body");
  }
  if (typeof body.userAgent !== "string") {
    throw new Error("invalid body.userAgent");
  }
  if (
    typeof body.config !== "object" ||
    typeof body.config.quality !== "string" ||
    typeof body.config.seed !== "string"
  ) {
    throw new Error("invalid body.config");
  }
}
function checkValidSuccessStat(body) {
  if (!body.stats || typeof body.stats !== "object")
    throw new Error("missing body.stats");
  if (typeof body.stats.averageFPS !== "number")
    throw new Error("invalid body.stats.averageFPS");
  if (typeof body.stats.bootTime !== "number")
    throw new Error("invalid body.stats.bootTime");
}
function checkValidFailureStat(body) {
  if (typeof body.error !== "string") throw new Error("missing body.error");
}

app.get("/stats", (req, res) => {
  fetchStats()
    .then(stats => {
      const successEntries = stats.filter(s => s.type === "success");
      const failureEntries = stats.filter(s => s.type === "failure");
      const out = {
        successCount: successEntries.length,
        failureCount: failureEntries.length,
        statsPerQuality: {
          low: successEntries
            .filter(s => s.config.quality === "low")
            .map(s => s.stats),
          medium: successEntries
            .filter(s => s.config.quality === "medium")
            .map(s => s.stats),
          high: successEntries
            .filter(s => s.config.quality === "high")
            .map(s => s.stats)
        }
      };
      res.json(out);
    })
    .catch(e => {
      console.error(e);
      res.status(500).send();
    });
});

app.post("/stats/failure", (req, res) => {
  Promise.resolve(req.body)
    .then(body => {
      checkValidStat(body);
      checkValidFailureStat(body);
      return recordStats(Object.assign({ type: "failure" }, body));
    })
    .then(res.send())
    .catch(e => {
      console.log(e);
      res.status(500).send();
    });
});
app.post("/stats/success", (req, res) => {
  Promise.resolve(req.body)
    .then(body => {
      checkValidStat(body);
      checkValidSuccessStat(body);
      return recordStats(Object.assign({ type: "success" }, body));
    })
    .then(res.send())
    .catch(e => {
      console.log(e);
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
    .then(({ ok, n, nModified, modifiedCount, upsertedCount }) => {
      const { username, levelReached, seed } = req.body.gameState;
      console.log("@" + seed + " lvl " + levelReached + " by " + username, {
        ok,
        n,
        nModified,
        modifiedCount,
        upsertedCount
      });
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
