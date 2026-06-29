const dns = require("node:dns");

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = process.env.MONGO_DB_URI;

// app.use(
//   cors({
//     origin: "http://localhost:3000",
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://skillswip.vercel.app",
    ],
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

// async function run() {
//   try {
//     await client.connect();
client.connect(() => {
    console.log('connecting to MOngo db');
}).catch(console.dir)

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
// app.post("/tasks", async (req, res) => {
//   try {
//     const task = req.body;

//     task.status = "open";
//     task.createdAt = new Date();

//     const result = await tasksCollection.insertOne(task);

//     res.send(result);
//   } catch (error) {
//     res.status(500).send({
//       message: "Failed to create task",
//     });
//   }
// });

// app.get("/tasks", async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 9;

//     const skip = (page - 1) * limit;

//     const tasks = await tasksCollection
//       .find({ status: "open" })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .toArray();

//     const total = await tasksCollection.countDocuments({
//       status: "open",
//     });

//     res.send({
//       tasks,
//       total,
//       totalPages: Math.ceil(total / limit),
//       currentPage: page,
//     });

//   } catch (error) {
//     res.status(500).send({
//       message: "Failed to fetch tasks",
//     });
//   }
// });
app.get("/tasks", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;

    const search = req.query.search || "";
    const category = req.query.category || "";

    const skip = (page - 1) * limit;

    const query = {
      status: "open",
    };

    if (search) {
      query.title = {
        $regex: search,
        $options: "i",
      };
    }

    if (category && category !== "All") {
      query.category = category;
    }

    const tasks = await tasksCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await tasksCollection.countDocuments(query);

    res.send({
      tasks,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });

  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch tasks",
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
  // const { ObjectId } = require("mongodb");

  const id = req.params.id;

  const result = await tasksCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});

// ===============Update Task
// const { ObjectId } = require("mongodb");

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
  // const { ObjectId } = require("mongodb");

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



app.post("/bids", async (req, res) => {
  try {
    const bid = req.body;

    // Task exists?
    const task = await tasksCollection.findOne({
      _id: new ObjectId(bid.taskId),
    });

    if (!task) {
      return res.status(404).send({
        message: "Task not found.",
      });
    }

    // Own task check
    if (task.clientEmail === bid.freelancerEmail) {
      return res.status(400).send({
        message: "You can't bid on your own task.",
      });
    }

    // Task closed check
    if (task.status !== "open") {
      return res.status(400).send({
        message: "Task is already closed.",
      });
    }

    // Duplicate bid check
    const existingBid = await bidsCollection.findOne({
      taskId: bid.taskId,
      freelancerEmail: bid.freelancerEmail,
    });

    if (existingBid) {
      return res.status(400).send({
        message: "You already submitted a proposal.",
      });
    }

    bid.status = "pending";
    bid.createdAt = new Date();

    const result = await bidsCollection.insertOne(bid);

    res.send(result);

  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal Server Error",
    });
  }
});

// ===============freelancer
app.get("/freelancers", async (req, res) => {
  const result = await usersCollection
    .find({ role: "freelancer" })
    .toArray();

  res.send(result);
});

// ======================freelancer bids==========
app.get("/bids/freelancer/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const result = await bidsCollection
      .find({ freelancerEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch bids",
    });
  }
});

// view proposal or bids
app.get("/bids/task/:taskId", async (req, res) => {
  try {
    const taskId = req.params.taskId;

    const result = await bidsCollection
      .find({ taskId })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch proposals",
    });
  }
});


// ==================bids api accept
app.patch("/bids/accept/:id", async (req, res) => {
  try {
    const bidId = req.params.id;

    // Find selected bid
    const bid = await bidsCollection.findOne({
      _id: new ObjectId(bidId),
    });

    if (!bid) {
      return res.status(404).send({
        message: "Bid not found",
      });
    }

    // Accept selected bid
    await bidsCollection.updateOne(
      { _id: new ObjectId(bidId) },
      {
        $set: {
          status: "accepted",
        },
      }
    );

    // Reject all other bids of same task
    await bidsCollection.updateMany(
      {
        taskId: bid.taskId,
        _id: { $ne: new ObjectId(bidId) },
      },
      {
        $set: {
          status: "rejected",
        },
      }
    );

    // Update task status
    await tasksCollection.updateOne(
      {
        _id: new ObjectId(bid.taskId),
      },
      {
        $set: {
          status: "in_progress",
        },
      }
    );

    res.send({
      success: true,
      message: "Bid accepted successfully",
    });

  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Internal Server Error",
    });
  }
});
// ============bids reject api
app.patch("/bids/reject/:id", async (req, res) => {
  try {
    const id = req.params.id;

    await bidsCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          status: "rejected",
        },
      }
    );

    res.send({
      success: true,
      message: "Bid rejected successfully",
    });

  } catch (error) {
    res.status(500).send({
      message: "Internal Server Error",
    });
  }
});

// ===================dynamic client dashboard
app.get("/dashboard/client/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const tasks = await tasksCollection
      .find({ clientEmail: email })
      .toArray();

    const totalTasks = tasks.length;

    const openTasks = tasks.filter(
      (task) => task.status === "open"
    ).length;

    const completedTasks = tasks.filter(
      (task) => task.status === "completed"
    ).length;

    const payments = await paymentsCollection
      .find({ clientEmail: email })
      .toArray();

    const totalPayments = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    res.send({
      totalTasks,
      openTasks,
      completedTasks,
      totalPayments,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to load dashboard",
    });
  }
});



app.get("/dashboard/freelancer/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const bids = await bidsCollection.find({
      freelancerEmail: email,
    }).toArray();

    const totalBids = bids.length;

    const payments = await paymentsCollection.find({
      freelancerEmail: email,
    }).toArray();

    const completedJobs = payments.length;

    const earnings = payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    const availableTasks = await tasksCollection.countDocuments({
      status: "open",
    });

    res.send({
      totalBids,
      completedJobs,
      earnings,
      availableTasks,
      recentBids: bids.slice(0, 5),
    });

  } catch (error) {
    res.status(500).send({
      message: "Failed to load dashboard",
    });
  }
});




// ===================freelancer profile


app.get("/freelancers/:id", async (req, res) => {
  try {
    const freelancer = await usersCollection.findOne({
      _id: new ObjectId(req.params.id),
      role: "freelancer",
    });

    if (!freelancer) {
      return res.status(404).send({
        message: "Freelancer not found",
      });
    }

    res.send(freelancer);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch freelancer",
    });
  }
});


// =============get profile
app.get("/profile/:email", async (req, res) => {
  const result = await usersCollection.findOne({
    email: req.params.email,
  });

  res.send(result);
});
// ============update profile
app.put("/profile/:email", async (req, res) => {
  const email = req.params.email;
  const profile = req.body;

  const result = await usersCollection.updateOne(
    { email },
    {
      $set: {
        name: profile.name,
        image: profile.image,
        bio: profile.bio,
        skills: profile.skills,
        experience: profile.experience,
        location: profile.location,
        hourlyRate: profile.hourlyRate,
      },
    }
  );

  res.send(result);
});

// ==============payment route========
// app.post("/create-payment-intent", async (req, res) => {
//   try {
//     const { amount } = req.body;

//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: amount * 100,
//       currency: "usd",
//       payment_method_types: ["card"],
//     });

//     res.send({
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (error) {
//     res.status(500).send({
//       message: error.message,
//     });
//   }
// });
// // =============payment details 
// app.get("/bids/:id", async (req, res) => {
//   const id = req.params.id;

//   const result = await bidsCollection.findOne({
//     _id: new ObjectId(id),
//   });

//   res.send(result);
// });
app.post("/payments", async (req, res) => {
  try {
    const payment = req.body;

    payment.createdAt = new Date();

    // Save payment
    const result = await paymentsCollection.insertOne(payment);

    // Update bid status
    await bidsCollection.updateOne(
      {
        _id: new ObjectId(payment.bidId),
      },
      {
        $set: {
          status: "paid",
        },
      }
    );

    // Update task status
    await tasksCollection.updateOne(
      {
        _id: new ObjectId(payment.taskId),
      },
      {
        $set: {
          status: "completed",
        },
      }
    );

    res.send(result);
  } catch (error) {
    console.log(error);

    res.status(500).send({
      message: "Payment failed.",
    });
  }
});

// =================admin========

app.get("/dashboard/admin", async (req, res) => {
  try {
    const totalUsers = await usersCollection.countDocuments();

    const totalClients = await usersCollection.countDocuments({
      role: "client",
    });

    const totalFreelancers = await usersCollection.countDocuments({
      role: "freelancer",
    });

    const totalTasks = await tasksCollection.countDocuments();

    const totalBids = await bidsCollection.countDocuments();

    const payments = await paymentsCollection.find().toArray();

    const totalRevenue = payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    res.send({
      totalUsers,
      totalClients,
      totalFreelancers,
      totalTasks,
      totalBids,
      totalRevenue,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to load dashboard",
    });
  }
});

// ===get all users

app.get("/admin/users", async (req, res) => {
  try {
    const users = await usersCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.send(users);
  } catch (error) {
    res.status(500).send({
      message: "Failed to load users",
    });
  }
});

// ======update role
app.patch("/admin/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { role } = req.body;

    const result = await usersCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          role,
        },
      }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Role update failed",
    });
  }
});
// delete user
app.delete("/admin/users/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await usersCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: "Delete failed",
    });
  }
});
// =======manage task==
app.get("/admin/tasks", async (req, res) => {
  try {
    const tasks = await tasksCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.send(tasks);
  } catch (error) {
    res.status(500).send({
      message: "Failed to fetch tasks",
    });
  }
});
// get staistic========
app.get("/dashboard/admin/statistics", async (req, res) => {
  try {
    const totalUsers = await usersCollection.countDocuments();

    const totalFreelancers = await usersCollection.countDocuments({
      role: "freelancer",
    });

    const totalClients = await usersCollection.countDocuments({
      role: "client",
    });

    const totalTasks = await tasksCollection.countDocuments();

    const openTasks = await tasksCollection.countDocuments({
      status: "open",
    });

    const completedTasks = await tasksCollection.countDocuments({
      status: "completed",
    });

    const totalPayments = await paymentsCollection.countDocuments();

    const totalRevenue = (
      await paymentsCollection.find().toArray()
    ).reduce((sum, item) => sum + Number(item.amount || 0), 0);

    res.send({
      totalUsers,
      totalClients,
      totalFreelancers,
      totalTasks,
      openTasks,
      completedTasks,
      totalPayments,
      totalRevenue,
    });
  } catch (err) {
    res.status(500).send({
      message: "Failed",
    });
  }
});


// ===========admin payments=====
app.get("/payments", async (req, res) => {
  const result = await paymentsCollection
    .find()
    .sort({ createdAt: -1 })
    .toArray();

  res.send(result);
});


    // MongoDB Ping
    // await client.db("admin").command({ ping: 1 });

    console.log("✅ MongoDB Connected Successfully");
//   } finally {
//     // await client.close();
//   }
// }

// run().catch(console.dir);







app.get("/", (req, res) => {
  res.send("SkillSwap Server is Running...");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;