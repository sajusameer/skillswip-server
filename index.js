const dns = require("node:dns");

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_DB_URI;

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());






// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const database = client.db("skillswip");

    const usersCollection = database.collection("users");
    const tasksCollection = database.collection("tasks");
    const bidsCollection = database.collection("bids");
    const paymentsCollection = database.collection("payments");

    // ==========================
    // Users API
    // ==========================

    app.post("/users", async (req, res) => {
      const user = req.body;

      const existingUser = await usersCollection.findOne({
        email: user.email,
      });

      if (existingUser) {
        return res.send({
          message: "User already exists",
        });
      }

      const result = await usersCollection.insertOne({
        ...user,
        createdAt: new Date(),
      });

      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;

      const result = await usersCollection.findOne({
        email,
      });

      res.send(result);
    });

    // MongoDB Ping
    await client.db("admin").command({ ping: 1 });

    console.log("✅ MongoDB Connected Successfully");
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);







app.get("/", (req, res) => {
  res.send("SkillSwap Server is Running...");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});