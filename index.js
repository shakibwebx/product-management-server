const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5001;

// Middleware - CRITICAL: Add body parsing middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// CORS configuration
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
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

// Global variable for collections
let productsCollection;

async function run() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB successfully.");

        const db = client.db("fatema-plaza");
        productsCollection = db.collection("products");

        // Confirm MongoDB connection
        await client.db("admin").command({ ping: 1 });
        console.log("✅ MongoDB ping successful.");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
}

// Initialize database connection
run().catch(console.dir);

// Health check
app.get('/', (req, res) => {
    res.send('🚀 Server is Running');
});

// POST: Add a product
app.post('/products', async (req, res) => {
    try {
        console.log("POST /products - Request body:", req.body);
        
        const product = req.body;
        
        // Validate required fields
        if (!product.category || !product.model) {
            return res.status(400).json({ 
                message: "Category and model are required fields" 
            });
        }

        // Ensure numeric fields are properly formatted
        const productData = {
            category: product.category,
            model: product.model,
            price: Number(product.price) || 0,
            stock: Number(product.stock) || 0,
            createdAt: new Date()
        };

        const result = await productsCollection.insertOne(productData);
        
        console.log("POST /products - Insert result:", result);
        res.status(201).json({ 
            message: "Product added successfully",
            insertedId: result.insertedId,
            ...result 
        });
    } catch (error) {
        console.error("POST /products - Error:", error);
        res.status(500).json({ 
            message: "Server error during product creation",
            error: error.message 
        });
    }
});

// GET: Fetch all products
app.get('/products', async (req, res) => {
    try {
        console.log("GET /products - Fetching all products");
        const products = await productsCollection.find().toArray();
        console.log("GET /products - Found", products.length, "products");
        res.json(products);
    } catch (error) {
        console.error("GET /products - Error:", error);
        res.status(500).json({ 
            message: "Server error during product fetch",
            error: error.message 
        });
    }
});

// PATCH: Sell product (reduce stock by 1)
app.patch('/products/:id/sell', async (req, res) => {
    try {
        const { id } = req.params;
        console.log("PATCH /products/:id/sell - Product ID:", id);

        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product ID format" });
        }

        // Find the product first
        const product = await productsCollection.findOne({ _id: new ObjectId(id) });
        
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (product.stock <= 0) {
            return res.status(400).json({ message: "Product is out of stock" });
        }

        // Update the stock
        const result = await productsCollection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $inc: { stock: -1 },
                $set: { lastSold: new Date() }
            }
        );

        console.log("PATCH /products/:id/sell - Update result:", result);

        if (result.modifiedCount === 0) {
            return res.status(400).json({ message: "Failed to update product stock" });
        }

        res.json({ 
            message: "Product sold successfully",
            modifiedCount: result.modifiedCount 
        });
    } catch (error) {
        console.error("PATCH /products/:id/sell - Error:", error);
        res.status(500).json({ 
            message: "Server error during sell operation",
            error: error.message 
        });
    }
});

// PATCH: Edit product
app.patch('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        console.log("PATCH /products/:id - Product ID:", id);
        console.log("PATCH /products/:id - Updates:", updates);

        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product ID format" });
        }

        // Check if product exists
        const existingProduct = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Validate and sanitize updates
        const allowedFields = ['category', 'model', 'price', 'stock'];
        const sanitizedUpdates = {};

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                if (field === 'price' || field === 'stock') {
                    const numValue = Number(updates[field]);
                    if (isNaN(numValue) || numValue < 0) {
                        return res.status(400).json({ 
                            message: `${field} must be a valid non-negative number` 
                        });
                    }
                    sanitizedUpdates[field] = numValue;
                } else if (field === 'category' || field === 'model') {
                    if (!updates[field] || typeof updates[field] !== 'string' || updates[field].trim() === '') {
                        return res.status(400).json({ 
                            message: `${field} cannot be empty` 
                        });
                    }
                    sanitizedUpdates[field] = updates[field].trim();
                }
            }
        }

        // Check if there are any valid updates
        if (Object.keys(sanitizedUpdates).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        // Add timestamp
        sanitizedUpdates.updatedAt = new Date();

        // Perform the update
        const result = await productsCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: sanitizedUpdates }
        );

        console.log("PATCH /products/:id - Update result:", result);

        if (result.modifiedCount === 0) {
            return res.status(400).json({ message: "No changes were made to the product" });
        }

        res.json({ 
            message: "Product updated successfully",
            modifiedCount: result.modifiedCount 
        });
    } catch (error) {
        console.error("PATCH /products/:id - Error:", error);
        res.status(500).json({ 
            message: "Server error during product update",
            error: error.message 
        });
    }
});

// DELETE: Remove product
app.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log("DELETE /products/:id - Product ID:", id);

        // Validate ObjectId
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product ID format" });
        }

        // Check if product exists
        const existingProduct = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
        
        console.log("DELETE /products/:id - Delete result:", result);

        if (result.deletedCount === 0) {
            return res.status(400).json({ message: "Failed to delete product" });
        }

        res.json({ 
            message: "Product deleted successfully",
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error("DELETE /products/:id - Error:", error);
        res.status(500).json({ 
            message: "Server error during product deletion",
            error: error.message 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error("Global error handler:", error);
    res.status(500).json({ 
        message: "Something went wrong!",
        error: error.message 
    });
});

// Handle 404 routes
app.use('*', (req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// Server listening
app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
});