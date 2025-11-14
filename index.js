const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const port = process.env.port || 3000;

const admin = require("firebase-admin");

// index.js
const decoded = Buffer.from(process.env.FIREBASE_SERVICE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//middleware
app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
  console.log("log in information");
  next();
};

const verifyFirebasToken = async (req, res, next) => {
  console.log("in the verify middleware", req.headers.authorization);
  if (!req.headers.authorization) {
    //do not allow to go
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email = userInfo.email;
    console.log("after token validation", userInfo);
    next();
  } catch {
    console.log("invalid token");
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const verifyJWTToken = (req, res, next) => {
  // console.log('in middleware',req.headers)
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    console.log("after decoded", decoded);
    req.token_email = decoded.email;
    next();
  });
};

const uri = process.env.DV_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Smart server is running");
});

async function run() {
  try {
    await client.connect();

    const db = client.db("smart_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");
    const usersCollection = db.collection("users");

    //jwt related api
    app.post("/getToken", async (req, res) => {
      const loggedUser = req.body;
      const token = jwt.sign(loggedUser, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token: token });
    });

    //USERS API
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        res.send({
          message: "user already exist.Do not need to insert again.",
        });
      } else {
        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      }
    });

    //PRODUCTS API
    app.get("/products", async (req, res) => {
      const cursor = productsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/latest-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await productsCollection.findOne(query);
      if (!result) {
        return res.status(404).send({ message: "Product not found" });
      }
      res.send(result);
    });

    app.post("/products", verifyFirebasToken, async (req, res) => {
      console.log("headers in the post", req.headers);
      const newProduct = req.body;
      // console.log(newProduct);
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: id };
      const update = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
      };
      const result = await productsCollection.updateOne(query, update);
      res.send(result);
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/bids", verifyFirebasToken, async (req, res) => {
      // console.log('headers', req.headers)
      const email = req.query.email;
      const query = {};
      if (email) {
        query.buyer_email = email;
      }

      //verify user have access to see this data
      if (email !== req.token_email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const cursor = bidsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // bids related api with firebase token verify
    // app.get("/bids",logger,verifyFirebasToken, async (req, res) => {
    //   console.log('api hitting')
    //   console.log("headers", req);
    //   const email = req.query.email;
    //   const query = {};
    //   if (email) {
    //     if(email !== req.token_email){
    //       return res.status(403).send({message: 'Forbidden Access'})
    //     }
    //     query.buyer_email = email;
    //   }
    //   const cursor = bidsCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    app.get("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.findOne(query);
      res.send(result);
    });

    app.get("/products/bids/:productId", verifyJWTToken, async (req, res) => {
      const productId = req.params.productId;
      const query = { product: productId };
      const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // app.get("/bids", async(req,res)=>{
    //   const query = {}
    //   if(query.email){
    //     query.buyer_email = email;
    //   }
    //   const cursor = bidsCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result)
    // })

    app.post("/bids", async (req, res) => {
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    });

    app.delete("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Smart server is running on port ${port}`);
});
