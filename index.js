const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();

const serviceAccount = require("./serviceKey.json");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MongoDB Connection
const uri = `mongodb+srv://pet-adoption:GN9e6GyGLCVNnyw9@cluster0.8v42xkx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Verify Firebase Token
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access. Token not found!" });
  }

  const token = authorization.split(" ")[1];

  try {
    await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access." });
  }
};

// Main DB Function
async function run() {
  try {
    const petDB = client.db("pet-adoption");
    const listCollection = petDB.collection("listing");
    const ordersCollection = petDB.collection("orders");

    app.get("/listing", async (req, res) => {
      const result = await listCollection.find().toArray();
      res.send(result);
    });

    app.get("/category/:categoryName", async (req, res) => {
      const categoryName = req.params.categoryName;

      const result = await listCollection
        .find({ category: categoryName })
        .toArray();

      res.send(result);
    });

    // GET single listing
    app.get("/listing/:id", verifyToken, async (req, res) => {
      const result = await listCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send({ success: true, result });
    });

    app.post("/listing", async (req, res) => {
      const data = req.body;
      const result = await listCollection.insertOne(data);
      res.send({ success: true, result });
    });

    app.put("/listing/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const update = { $set: req.body };
      const result = await listCollection.updateOne(filter, update);
      res.send({ success: true, result });
    });

    // DELETE listing
    app.delete("/listing/:id", async (req, res) => {
      const result = await listCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send({ success: true, result });
    });

    // Latest 6 listings
    app.get("/latest-list", async (req, res) => {
      const result = await listCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    });

    app.get("/my-models", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await listCollection.find({ created_by: email }).toArray();
      res.send(result);
    });

    // Orders
    app.post("/orders/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;

      const result = await ordersCollection.insertOne(data);

      const update = { $inc: { downloads: 1 } };
      const downloadCounted = await listCollection.updateOne(
        { _id: new ObjectId(id) },
        update
      );

      res.send({ result, downloadCounted });
    });

    app.get("/my-downloads", verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await ordersCollection
        .find({ downloaded_by: email })
        .toArray();
      res.send(result);
    });

    app.get("/search", async (req, res) => {
      const search = req.query.search;
      const result = await listCollection
        .find({ name: { $regex: search, $options: "i" } })
        .toArray();
      res.send(result);
    });

    console.log("Server Connected to MongoDB successfuly!");
  } finally {
  }
}
run().catch(console.dir);

// Root
app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
