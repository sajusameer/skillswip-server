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


// ===============task========
app.post("/tasks", async (req, res) => {
  try {
    const task = req.body;

    task.status = "open";
    task.createdAt = new Date();

    const result = await tasksCollection.insertOne(task);

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to create task",
    });
  }
});



app.get("/tasks/client/:email", async (req, res) => {
  const email = req.params.email;

  const result = await tasksCollection
    .find({ clientEmail: email })
    .sort({ createdAt: -1 })
    .toArray();

  res.send(result);
});

app.delete("/tasks/:id", async (req, res) => {
  const { ObjectId } = require("mongodb");

  const id = req.params.id;

  const result = await tasksCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});

// ===============Update Task
const { ObjectId } = require("mongodb");

app.put("/tasks/:id", async (req, res) => {
  const id = req.params.id;

  const updatedTask = req.body;

  const result = await tasksCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        title: updatedTask.title,
        category: updatedTask.category,
        description: updatedTask.description,
        budget: updatedTask.budget,
        deadline: updatedTask.deadline,
      },
    }
  );

  res.send(result);
}); 

// ============get single task=========

app.get("/tasks/:id", async (req, res) => {
  const { ObjectId } = require("mongodb");

  const id = req.params.id;

  const result = await tasksCollection.findOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});




// ===========browse task========
app.get("/tasks", async (req, res) => {
  try {
    const result = await tasksCollection
      .find({ status: "open" })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch tasks" });
  }
});

// ==================bid====
app.post("/bids", async (req, res) => {
  const bid = req.body;

  bid.status = "pending";
  bid.createdAt = new Date();

  const result = await bidsCollection.insertOne(bid);

  res.send(result);
});


// ===============freelancer
app.get("/freelancers", async (req, res) => {
  const result = await usersCollection
    .find({ role: "freelancer" })
    .toArray();

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