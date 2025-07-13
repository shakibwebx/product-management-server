const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// CORS configuration
const allowedOrigins = [
    "http://localhost:3000",
    "https://fatema-telecom-skb.vercel.app",
    "https://products-management-client-pink.vercel.app",
    "https://crud-server-puce.vercel.app"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wnfuk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    const client = new MongoClient(uri, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });

    await client.connect();
    const db = client.db("fatema-plaza");

    cachedClient = client;
    cachedDb = db;

    console.log("✅ Connected to MongoDB (cold start).");
    return { client, db };
}

// Routes

app.get('/', (req, res) => {
    res.send('🚀 Server is Running');
});

// GET: Fetch all products
app.get('/products', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const products = await db.collection("products").find().toArray();
        res.send(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send({ message: "Server error while fetching products" });
    }
});

// POST: Add a product
app.post('/products', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const product = req.body;

        if ((!product.name && !product.model) || !product.price || product.stock === undefined) {
            return res.status(400).send({
                message: "Missing required fields: name or model, price, and stock are required"
            });
        }

        product.price = parseFloat(product.price);
        product.stock = parseInt(product.stock);

        if (isNaN(product.price) || isNaN(product.stock)) {
            return res.status(400).send({
                message: "Price and stock must be valid numbers"
            });
        }

        const result = await db.collection("products").insertOne(product);
        res.status(201).send({
            message: "Product added successfully",
            result
        });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).send({ message: "Server error during product insertion" });
    }
});

// GET: Fetch single product by ID
app.get('/products/:id', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid product ID format" });
        }

        const product = await db.collection("products").findOne({ _id: new ObjectId(id) });
        if (!product) {
            return res.status(404).send({ message: "Product not found" });
        }

        res.send(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).send({ message: "Server error while fetching product" });
    }
});

// PATCH: Edit product
app.patch('/products/:id', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const id = req.params.id;
        const updates = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid product ID format" });
        }

        const validUpdates = {};
        Object.keys(updates).forEach(key => {
            if (updates[key] !== undefined && updates[key] !== null && updates[key] !== '') {
                validUpdates[key] = updates[key];
            }
        });

        if (Object.keys(validUpdates).length === 0) {
            return res.status(400).send({ message: "No valid fields to update" });
        }

        if (validUpdates.price !== undefined) {
            validUpdates.price = parseFloat(validUpdates.price);
            if (isNaN(validUpdates.price)) {
                return res.status(400).send({ message: "Price must be a valid number" });
            }
        }

        if (validUpdates.stock !== undefined) {
            validUpdates.stock = parseInt(validUpdates.stock);
            if (isNaN(validUpdates.stock)) {
                return res.status(400).send({ message: "Stock must be a valid number" });
            }
        }

        const result = await db.collection("products").updateOne(
            { _id: new ObjectId(id) },
            { $set: validUpdates }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Product not found" });
        }

        res.send({
            message: "Product updated successfully",
            result
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).send({ message: "Server error during update" });
    }
});

// PATCH: Sell product (decrease stock by 1)
app.patch('/products/:id/sell', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid product ID format" });
        }

        const product = await db.collection("products").findOne({ _id: new ObjectId(id) });
        if (!product) {
            return res.status(404).send({ message: "Product not found" });
        }

        if (product.stock <= 0) {
            return res.status(400).send({ message: "Out of stock" });
        }

        const result = await db.collection("products").updateOne(
            { _id: new ObjectId(id) },
            { $inc: { stock: -1 } }
        );

        res.send({
            message: "Product sold successfully",
            result
        });
    } catch (error) {
        console.error('Error selling product:', error);
        res.status(500).send({ message: "Server error during sale" });
    }
});

// DELETE: Remove product
app.delete('/products/:id', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid product ID format" });
        }

        const result = await db.collection("products").deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "Product not found" });
        }

        res.send({
            message: "Product deleted successfully",
            result
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send({ message: "Server error during deletion" });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Something went wrong!' });
});

module.exports = app;
