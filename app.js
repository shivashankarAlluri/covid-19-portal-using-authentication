const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
app.use(express.json());
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
let database = null;
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBandServer = async () => {
  try {
    database = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at 3000 port");
    });
  } catch (e) {
    console.log(`database error at ${e.message}`);
    process.exit(1);
  }
};
initializeDBandServer();
//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectedQuery = `SELECT * FROM user
    WHERE username='${username}';`;
  const dbUser = await database.get(selectedQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPassword = await bcrypt.compare(password, dbUser.password);
    if (isPassword === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "GVVYITCLKOCITCYIIXRIIIC");
      response.send({ jwtToken });
    }
  }
});

const authorizationToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "GVVYITCLKOCITCYIIXRIIIC", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
let convertDB = (object) => {
  return {
    stateId: object.state_id,
    stateName: object.state_name,
    population: object.population,
  };
};
//API 2
app.get("/states/", authorizationToken, async (request, response) => {
  const stateQuery = `SELECT * FROM state;`;
  const stateDetails = await database.all(stateQuery);
  response.send(stateDetails.map((object) => convertDB(object)));
});
//API 3
app.get("/states/:stateId/", authorizationToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const stateDetails = await database.get(stateQuery);
  response.send(convertDB(stateDetails));
});
//API 4
app.post("/districts/", authorizationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const selectedQuery = `INSERT INTO district
  (district_name,state_id,cases,cured,active,deaths)
  VALUES
  ('${districtName}',${stateId},${cases},${cured},${active},${deaths});
  `;
  const insertedQuery = await database.run(selectedQuery);
  response.send("District Successfully Added");
});

//API 5
const convertDBtoResponse = (object) => {
  return {
    districtId: object.district_id,
    districtName: object.district_name,
    stateId: object.state_id,
    cases: object.cases,
    cured: object.cured,
    active: object.active,
    deaths: object.deaths,
  };
};
app.get(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const districtQuery = `SELECT * FROM district WHERE district_id=${districtId};`;
      const districtDetails = await database.get(districtQuery);
      response.send(convertDBtoResponse(districtDetails));
    } catch (e) {
      console.log(`${e.message}`);
    }
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    const districtDetails = await database.run(districtQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    try {
      const selectedQuery = `UPDATE district
        SET
        district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
        WHERE district_id=${districtId};`;
      await database.run(selectedQuery);
      response.send("District Details Updated");
    } catch (e) {
      console.log(`database error at ${e.message}`);
    }
  }
);

//API 8

app.get(
  "/states/:stateId/stats/",
  authorizationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const totalStateStatsQuery = `
    SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
    FROM 
        district 
    WHERE 
        state_id=${stateId};`;
    const main = await database.get(totalStateStatsQuery);
    response.send({
      totalCases: main["SUM(cases)"],
      totalCured: main["SUM(cured)"],
      totalActive: main["SUM(active)"],
      totalDeaths: main["SUM(deaths)"],
    });
  }
);

module.exports = app;
