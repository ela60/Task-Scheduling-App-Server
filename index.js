const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const WebSocket = require("ws");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kisu1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// WebSocket Server
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

// Broadcast function to send updates to all clients
const broadcastUpdate = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

async function run() {
  try {
    // await client.connect();
    const taskCollection = client.db("taskDB").collection("Task");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorize access1" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err) {
          return res.status(401).send({ message: "unauthorize access2" });
        }
        req.decode = decode;
        next();
      });
    };

    // Get all tasks
    app.get("/api/tasks", async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result);
    });

    // Get a single task
    app.get("/api/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const result = await taskCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Create a new task
    app.post("/api/tasks", async (req, res) => {
      const newTask = req.body;
      const result = await taskCollection.insertOne(newTask);
      broadcastUpdate(await taskCollection.find().toArray()); // Notify clients
      res.send(result);
    });

    // Update a task
    app.put("/api/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateTask = req.body;
      const updateDoc = {
        $set: {
          title: updateTask.title,
          description: updateTask.description,
          category: updateTask.category,
        },
      };
      const result = await taskCollection.updateOne(filter, updateDoc);
      broadcastUpdate(await taskCollection.find().toArray()); // Notify clients
      res.send(result);
    });

    // Delete a task
    app.delete("/api/tasks/:id", async (req, res) => {
      const id = req.params.id;
      await taskCollection.deleteOne({ _id: new ObjectId(id) });
      broadcastUpdate(await taskCollection.find().toArray()); // Notify clients
      res.send({ message: "Task deleted" });
    });

    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error(error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Task management server is running");
});

// Start the HTTP server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
