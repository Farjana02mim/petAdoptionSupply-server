// index.js
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();

const serviceAccount = require("./serviceKey.json");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MongoDB Connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Verify Firebase Token Middleware
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization)
    return res.status(401).send({ message: "Unauthorized! Token not found." });

  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized! Invalid token." });
  }
};

// Main DB Function
async function run() {
  try {
    const petDB = client.db("pet-adoption");
    const listCollection = petDB.collection("listing");
    const ordersCollection = petDB.collection("orders");

    // GET all listings
    app.get("/listing", async (req, res) => {
      try {
        const result = await listCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // GET listings by category
    app.get("/category/:categoryName", async (req, res) => {
      try {
        const categoryName = req.params.categoryName;
        const result = await listCollection.find({ category: categoryName }).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // GET single listing (protected)
    app.get("/listing/:id", verifyToken, async (req, res) => {
      try {
        const result = await listCollection.findOne({ _id: new ObjectId(req.params.id) });
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // POST new listing
    app.post("/listing", async (req, res) => {
      try {
        const data = req.body;
        data.created_at = new Date(); // add timestamp
        const result = await listCollection.insertOne(data);
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // UPDATE listing
    app.put("/listing/:id", async (req, res) => {
      try {
        const filter = { _id: new ObjectId(req.params.id) };
        const update = { $set: req.body };
        const result = await listCollection.updateOne(filter, update);
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // DELETE listing
    app.delete("/listing/:id", async (req, res) => {
      try {
        const result = await listCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Latest 6 listings
    app.get("/latest-list", async (req, res) => {
      try {
        const result = await listCollection.find().sort({ created_at: -1 }).limit(6).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Get user's listings (protected)
    app.get("/my-models", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const result = await listCollection.find({ created_by: email }).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // POST order
    app.post("/orders/:id", async (req, res) => {
      try {
        const data = req.body;
        const id = req.params.id;

        const result = await ordersCollection.insertOne(data);
        const downloadCounted = await listCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { downloads: 1 } }
        );

        res.send({ result, downloadCounted });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Get user's downloads (protected)
    app.get("/my-downloads", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const result = await ordersCollection.find({ downloaded_by: email }).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Search listings
    app.get("/search", async (req, res) => {
      try {
        const search = req.query.search;
        const result = await listCollection
          .find({ name: { $regex: search, $options: "i" } })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    console.log("Server Connected to MongoDB successfully!");
  } finally {
    // Optional: you can close client if needed
  }
}

// Run DB connection
run().catch(console.dir);

// Root route
app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

// Start server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
