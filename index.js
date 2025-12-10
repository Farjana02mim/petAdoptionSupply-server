const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
require("dotenv").config();

const serviceAccount = require("./serviceKey.json");

const app = express();
const port = process.env.PORT || 3000;


const corsOptions = {
  origin: [
    'http://localhost:5173',                  // dev
    'https://pet-adoption-supply.web.app'    // production
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

// Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// MongoDB
const client = new MongoClient(process.env.MONGO_URI, {
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
    req.user = null;
    return next();
  }
  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized! Invalid token." });
  }
};

async function run() {
  try {
    const db = client.db("pet-adoption");
    const listCollection = db.collection("listing");
    const ordersCollection = db.collection("orders");

    // Get latest 6 listings
    app.get("/latest-list", async (req, res) => {
      try {
        const result = await listCollection
          .find()
          .sort({ created_at: -1 })
          .limit(6)
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Get all listings
    app.get("/listing", async (req, res) => {
      try {
        const result = await listCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Add Listing
    app.post("/listing", async (req, res) => {
      try {
        const data = req.body;
        data.created_at = new Date();
        const result = await listCollection.insertOne(data);
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Update Listing
    app.put("/listing/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;

        const result = await listCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: data }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, result });
        } else {
          res.send({ success: false, message: "Update failed" });
        }
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Delete Listing
    app.delete("/listing/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        const result = await listCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount > 0) {
          res.send({ success: true });
        } else {
          res.send({ success: false, message: "Delete failed" });
        }
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Get category listings
    app.get("/category/:categoryName", async (req, res) => {
      try {
        const result = await listCollection
          .find({ category: req.params.categoryName })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Search
    app.get("/search", async (req, res) => {
      try {
        const search = req.query.search || "";
        const result = await listCollection
          .find({ name: { $regex: search, $options: "i" } })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Listing by ID (with token)
    app.get("/listing/:id", verifyToken, async (req, res) => {
      try {
        const result = await listCollection.findOne({ _id: new ObjectId(req.params.id) });
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Orders
    app.post("/orders/:id", verifyToken, async (req, res) => {
      try {
        const data = req.body;
        const id = req.params.id;
        const result = await ordersCollection.insertOne(data);
        await listCollection.updateOne({ _id: new ObjectId(id) }, { $inc: { downloads: 1 } });
        res.send({ success: true, result });
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    // Delete order
app.delete("/orders/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const result = await ordersCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount > 0) {
      res.send({ success: true });
    } else {
      res.send({ success: false, message: "Delete failed" });
    }
  } catch (err) {
    res.status(500).send({ success: false, message: err.message });
  }
});


    // My downloads
    app.get("/my-downloads", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const result = await ordersCollection
          .find({ downloaded_by: { $regex: `^${email}$`, $options: "i" } })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, message: err.message });
      }
    });

    console.log("MongoDB Connected ✅");
  } finally {
    // do not close client
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(port, () => console.log(`Server listening on port ${port} 🚀`));
