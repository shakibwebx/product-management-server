const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const app = express();
const port = process.env.PORT || 5001;

// Middleware
const allowedOrigins = [
    "http://localhost:3000",
    "https://products-management-client-pink.vercel.app",
    "https://crud-server-puce.vercel.app"
  ];
  
  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wnfuk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

        const db = client.db("fatema-plaza");
        const productsCollection = db.collection("products");

        // POST: Add a product
        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productsCollection.insertOne(product);
            res.send(result);
        });

        // ✅ GET: Fetch all products
        app.get('/products', async (req, res) => {
            const products = await productsCollection.find().toArray();
            res.send(products);
        });


        app.patch('/products/:id/sell', async (req, res) => {
          const { id } = req.params;
          const productsCollection = client.db("fatema-plaza").collection("products");
      
          try {
              const product = await productsCollection.findOne({ _id: new ObjectId(id) });
              if (!product) return res.status(404).send({ message: "Product not found" });
              if (product.stock <= 0) return res.status(400).send({ message: "Out of stock" });
      
              const updated = await productsCollection.updateOne(
                  { _id: new ObjectId(id) },
                  { $inc: { stock: -1 } }
              );
      
              res.send(updated);
          } catch (error) {
              console.error(error);
              res.status(500).send({ message: "Server error" });
          }
      });



      // DELETE: Remove product
app.delete('/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
      const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
  } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Server error during deletion." });
  }
});

// PATCH: Edit product
app.patch('/products/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body; // Expect { category, model, price, stock }
  try {
      const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
      );
      res.send(result);
  } catch (error) {
      console.error(error);
      res.status(500).send({ message: "Server error during update." });
  }
});

        // Confirm MongoDB connection
        await client.db("admin").command({ ping: 1 });
        console.log("✅ Connected to MongoDB successfully.");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
    }
}
run().catch(console.dir);

// Health check
app.get('/', (req, res) => {
    res.send('🚀 Server is Running');
});

// Server listening
app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
});
