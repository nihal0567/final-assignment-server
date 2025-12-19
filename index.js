require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe");

// Stripe initialization - apiVersion remove করা হয়েছে (default use করবে)
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("Error: STRIPE_SECRET_KEY missing in .env file!");
}

if (!process.env.SITE_DOMAIN) {
  console.error("Error: SITE_DOMAIN missing in .env file!");
}

const app = express();
const port = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.VITE_DB_USER}:${process.env.VITE_DB_PASS}@cluster0.ue9fgze.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("app is running");
});

async function run() {
  try {
    await client.connect();
    const db = client.db("myDb");
    const usersCollection = db.collection("users");
    const productCollection = db.collection("add-products");
    const orderCollection = db.collection("order-collection");

    // Create order
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send({ insertedId: result.insertedId.toString() });
    });

    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await orderCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated }
      );
      res.send(result);
    });

    app.get("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Update user role/status
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated }
      );
      res.send(result);
    });

    // Get all orders (with optional status filter)
    app.get("/orders", async (req, res) => {
      const status = req.query.status;
      const query = status ? { status } : {};
      const result = await orderCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get('/products', async (req, res) => {
  const result = await productCollection.find().sort({ createdAt: -1 }).toArray();
  res.send(result);
});

// Update product (for showOnHome toggle)
app.patch('/products/:id', async (req, res) => {
  const id = req.params.id;
  const updated = req.body;
  const result = await productCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updated }
  );
  res.send(result);
});

// Delete product
app.delete('/products/:id', async (req, res) => {
  const id = req.params.id;
  const result = await productCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.get('/products', async (req, res) => {
  const result = await productCollection.find().sort({ createdAt: -1 }).toArray();
  res.send(result);
});

    // Create user
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "buyer";
      user.status = "pending";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await usersCollection.findOne({ email });
      if (userExists) {
        return res.send({ message: "user exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Get all products
    app.get("/products", async (req, res) => {
      const email = req.query.email;
      const query = email ? { email } : {};
      const options = { sort: { createdAt: -1 } };
      const result = await productCollection.find(query, options).toArray();
      res.send(result);
    });

    // Get single product
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send({
        success: true,
        result,
      });
    });

    // Add new product
    app.post("/products", async (req, res) => {
      const productData = req.body;
      productData.createdAt = new Date();
      const result = await productCollection.insertOne(productData);
      res.send(result);
    });

    // Update product
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id) };
      const update = { $set: updatedProduct };
      const result = await productCollection.updateOne(query, update);
      res.send(result);
    });

    // Delete product
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    // Get 6 limited products
    app.get("/limit-products", async (req, res) => {
      const result = await productCollection
        .find()
        .sort({ price: "asc" })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // ====================== STRIPE PAYMENT INTEGRATION ======================

    // Create Stripe checkout session (modified with validation)
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      console.log("Received payment info from frontend:", paymentInfo);

      try {
        // Validation: orderPrice must be positive number
        const orderPrice = Number(paymentInfo.orderPrice);
        if (!orderPrice || orderPrice <= 0) {
          console.error("Invalid orderPrice:", paymentInfo.orderPrice);
          return res.status(400).json({
            error: "Order price is missing or invalid (must be greater than 0)",
          });
        }

        const session = await stripeInstance.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd", // "bdt" if supported by your Stripe account
                product_data: {
                  name: paymentInfo.productTitle || "Order Payment",
                  description: `Order for ${
                    paymentInfo.orderQuantity || 1
                  } units`,
                },
                unit_amount: Math.round(orderPrice * 100), // cents
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
          metadata: {
            orderId: paymentInfo.orderId,
          },
          customer_email: paymentInfo.email,
        });

        console.log("Stripe session created successfully:", session.id);
        res.json({ url: session.url });
      } catch (error) {
        console.error("Stripe checkout error:", error.message);
        console.error("Full error details:", error);
        res
          .status(500)
          .json({ error: error.message || "Failed to create Stripe session" });
      }
    });

    // Verify payment
    app.get("/verify-payment/:sessionId", async (req, res) => {
      try {
        const session = await stripeInstance.checkout.sessions.retrieve(
          req.params.sessionId
        );

        if (session.payment_status === "paid") {
          await orderCollection.updateOne(
            { _id: new ObjectId(session.metadata.orderId) },
            {
              $set: {
                paymentStatus: "paid",
                status: "confirmed",
                updatedAt: new Date(),
              },
            }
          );
          res.json({ success: true, message: "Payment successful" });
        } else {
          res.json({ success: false, message: "Payment not completed" });
        }
      } catch (err) {
        console.error("Payment verification error:", err);
        res.status(500).json({ error: "Verification failed" });
      }
    });

    // ====================== STRIPE END ======================

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("Error in run function:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
