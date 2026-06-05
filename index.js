require("dotenv").config();
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Stripe initialization - apiVersion remove করা হয়েছে (default use করবে)


function generateTrackingId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `TRK-${date}-${random}`;
}

const app = express();
const port = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());

const verifyFBToken = (req, res, next) => {
  console.log("headers in the middleware", req.headers.authorization);
  next();
};

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@ac-w32evej-shard-00-00.ue9fgze.mongodb.net:27017,ac-w32evej-shard-00-01.ue9fgze.mongodb.net:27017,ac-w32evej-shard-00-02.ue9fgze.mongodb.net:27017/?ssl=true&replicaSet=atlas-fdhl35-shard-0&authSource=admin&appName=Cluster0`;

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
    const db = client.db("myDb");
    const usersCollection = db.collection("users");
    const productCollection = db.collection("products");
    const orderCollection = db.collection("orders");
    const paymentCollection = db.collection("payments");
    const roleCollection = db.collection("userRole-collection");

    

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated },
      );
      res.send(result);
    });

    app.get("/my-orders/:email", async(req, res) =>{
      const email = req.params.email 

      const result = await paymentCollection.find({customerEmail: email}).toArray()
      res.send(result)
    })
    
    // Get all orders (with optional status filter)
    // app.get("/orders", async (req, res) => {
    //   const status = req.query.status;
    //   const query = status ? { status } : {};
    //   console.log(req.headers);
    //   const result = await orderCollection
    //     .find(query)
    //     .sort({ createdAt: -1 })
    //     .toArray();
    //   res.send(result);
    // });

    // Update product (for showOnHome toggle)
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await productCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated },
      );
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
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

    // Get all products (product-collection) // Get all products (product-collection)
    app.get("/products", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      // console.log(req.query);
      const options = { sort: { createdAt: -1 } };
      const result = await productCollection.find(query, options).toArray();
      res.send(result);
    });

    // Get a single product
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

    // Update a product
    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: updatedProduct,
      };
      const result = await productCollection.updateOne(query, update);
      res.send(result);
    });

    // Delete a product
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

    // Create Stripe checkout session (modified with validation)
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);

      const orderPrice = Number(paymentInfo.orderPrice);
      if (!orderPrice || orderPrice <= 0) {
        console.error("Invalid orderPrice:", paymentInfo.orderPrice);
        return res.status(400).json({
          error: "Order price is missing or invalid (must be greater than 0)",
        });
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: paymentInfo?.productTitle || "Product",

                description: paymentInfo?.notes,
                images: [paymentInfo?.productImage],
              },
              unit_amount: paymentInfo?.productPrice * 100,
            },
            quantity: paymentInfo?.minOrderQuantity,
          },
        ],
        customer_email: paymentInfo.buyer.email,
        mode: "payment",
        metadata: {
          orderId: paymentInfo.productId,
          buyer: paymentInfo?.buyer.email,
          orderQuantity: paymentInfo?.minOrderQuantity
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/verify-payment?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,

        customer_email: paymentInfo.email,
      });

      res.send({ url: session.url });
    });

    // Verify payment
    app.patch("/verify-payment", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const transactionId = session.payment_intent;
    //  const orderQuantity = session.metadata.orderQuantity
      const query = { transactionId: transactionId };

      const paymentExist = await paymentCollection.findOne(query);
      if (paymentExist) {
        return res.send({
          message: "already exist",
            transactionId,
          });
        }
        const trackingId = generateTrackingId();
        
      const product = await productCollection.findOne({
        _id: new ObjectId(session.metadata.orderId),
      });
      console.log("from session", session);
      
      

      if (session.payment_status === "paid" && product) {

        await paymentCollection.updateOne(
          { _id: new ObjectId(session.metadata.orderId) },
          {
            $set: {
              trackingId: trackingId,
              transactionId: transactionId,
              status: "pending",
              paymentStatus: "paid",
              paidAt: new Date(),
            },
          },
        );
        const paymentDetails = {
          amount: session.amount_total / 100,
          product: product.productName,
          orderQuantity: Number(session.metadata.orderQuantity),
          currency: session.currency,
          customerEmail: session.customer_email,
          buyer_email: session.metadata.buyer,
          orderId: session.metadata.orderId,
          status: "pending",
          paymentStatus: "paid",
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
        };
        console.log("payment details", paymentDetails);

        const result = await paymentCollection.insertOne(paymentDetails)

        // update product quantity
        await productCollection.updateOne({
           _id: new ObjectId(session.metadata.orderId)
          },
          { $inc: { productQuantity: - Number(session.metadata.orderQuantity) } }
        )

        return res.send({
          transactionId: session.payment_intent,
          orderId: result.insertedId
        })

      }
      res.send(res.send({
          transactionId: session.payment_intent,
          orderId: result.product._id
        }))
    });

    // ====================== STRIPE END ======================

    

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } catch (error) {
    console.error("Error in run function:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

