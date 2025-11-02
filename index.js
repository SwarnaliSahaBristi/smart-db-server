const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
require('dotenv').config()
const port = process.env.port || 3000

//middleware
app.use(cors());
app.use(express.json());

const uri = process.env.DV_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res) => {
  res.send('Smart server is running')
})

async function run() {
  try {
    await client.connect();

    const db = client.db("smart_db");
    const productsCollection = db.collection("products");
    const bidsCollection = db.collection("bids");

    app.get('/products', async(req,res)=>{
      const cursor = productsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/products/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await productsCollection.findOne(query);
      res.send(result);
    })

    app.post('/products', async(req,res)=>{
        const newProduct = req.body;
        console.log(newProduct)
        const result = await productsCollection.insertOne(newProduct);
        res.send(result);
    })

    app.patch('/products/:id', async(req,res)=>{
        const id = req.params.id;
        const updatedProduct = req.body;
        const query = {_id: new ObjectId(id)};
        const update = {
          $set:{
            name: updatedProduct.name,
            price: updatedProduct.price,
          }
        }
        const result = await productsCollection.updateOne(query,update);
        res.send(result);
    })

    app.delete('/products/:id', async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    })

    // bids related api
    app.get('/bids', async(req,res)=>{
      const email = req.query.email;
      const query = {};
      if(email){
        query.buyer_email = email;
      }
      const cursor = bidsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/bids/:id', async(req,res)=>{
      const id = req.params.id;
      const query= {_id: new ObjectId(id)};
      const result = await bidsCollection.findOne(query);
      res.send(result);
    })

    app.post('/bids', async(req,res)=>{
      const newBid = req.body;
      const result = await bidsCollection.insertOne(newBid);
      res.send(result);
    })

    app.delete('/bids/:id', async(req,res)=>{
      const id = req.params.id;
      const query= {_id: ObjectId(id)};
      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Smart server is running on port ${port}`)
})