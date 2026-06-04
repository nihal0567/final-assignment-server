require("dotenv").config();
const express = require("express");
const cors = require("cors");
const stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Stripe initialization - apiVersion remove করা হয়েছে (default use করবে)
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

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

    //create user role
    // app.post("/users", async(req, res) => {
    //   const user = req.body;
    //   user.role = "buyer";
    //   user.createdAt = new Date()
    //   const result = await usersCollection.insertOne(user)
    //   res.send(result)
    // })

    // Create order

    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send({ insertedId: result.insertedId.toString() });
    });

    app.get("/orders", async (req, res) => {
      // const id = req.params.id;
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      console.log(req.query);
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    app.get("/orders/:orderId", async (req, res) => {
      const id = req.params.orderId;
      const query = {};
      const result = await orderCollection.findOne(query);
      res.send(result);
    });

    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await orderCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated },
      );
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated },
      );
      res.send(result);
    });

    // Get all orders (with optional status filter)
    app.get("/orders", async (req, res) => {
      const status = req.query.status;
      const query = status ? { status } : {};
      console.log(req.headers);
      const result = await orderCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

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

      const session = await stripeInstance.checkout.sessions.create({
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
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/verify-payment?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,

        customer_email: paymentInfo.email,
      });

      res.send({ url: session.url });
    });

    // Verify payment
    app.post("/verify-payment", async (req, res) => {
      const sessionId = req.query.session_id;

      const session =
        await stripeInstance.checkout.sessions.retrieve(sessionId);

      const trackingId = generateTrackingId();
      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };

      const product = await productCollection.findOne({
        _id: new ObjectId(session.metadata.orderId),
      });

      console.log("from product", product);
      const paymentExist = await paymentCollection.findOne(query);
        if (paymentExist) {
          return res.send({
            message: "already exist",
            transactionId,
            trackingId,
          });
        }

      if (session.payment_status === "paid") {

        // const update = {
        //   $set: {
            
        //   }
        // }
        await orderCollection.updateOne(
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
          orderQuantity: product.minOrderQuantity,
          currency: session.currency,
          customerEmail: session.customer_email,
          buyer_email: session.metadata.buyer,
          orderId: session.metadata.orderId,
          status: "pending",
          paymentStatus: "paid",
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          trackingId: trackingId,
          paidAt: new Date(),
        };
        console.log("payment details", paymentDetails);

        const result = await paymentCollection.insertOne(paymentDetails)
        res.json({
          success: true, result 
        })
      }
    });

    // ====================== STRIPE END ======================

    // app.get("/payments", async (req, res) => {
    //   const email = req.query.email;
    //   const query = {};
    //   console.log("headers", req.headers);
    //   if (email) {
    //     query.customerEmail = email;
    //   }
    //   console.log("headers", req.headers.aothorization);
    //   const cursor = paymentCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.json({ result });
    // });

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

// Create Stripe checkout session (modified with validation)

// app.post("/create-checkout-session", async (req, res) => {
//   const paymentInfo = req.body;
//   console.log(req.paymentInfo);

//   const orderPrice = Number(paymentInfo.orderPrice);
//   if (!orderPrice || orderPrice <= 0) {
//     console.error("Invalid orderPrice:", paymentInfo.orderPrice);
//     return res.status(400).json({
//       error: "Order price is missing or invalid (must be greater than 0)",
//     });
//   }

//   const session = await stripeInstance.checkout.sessions.create({
//     line_items: [
//       {
//         price_data: {
//           currency: "usd",
//           product_data: {
//             name: paymentInfo?.productTitle || "Product",
//             description: paymentInfo?.notes,
//             images: [paymentInfo?.productImage],
//           },
//           unit_amount: paymentInfo?.productPrice * 100,
//         },
//         quantity: paymentInfo?.orderQuantity,
//       },
//     ],
//     customer_email: paymentInfo.buyer.email,
//     mode: "payment",
//     metadata: {
//       orderId: paymentInfo.orderId,
//       buyer: paymentInfo?.buyer.email,
//     },
//     success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//     cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,

//     customer_email: paymentInfo.email,
//   });

//   res.send({ url: session.url });
// });

// const onPayment = async (data) => {
//   const orderData = {
//     productId: product._id,
//     productTitle: product.productName,
//     productImage: product.productImages[0],
//     productPrice: product.productPrice,
//     orderQuantity: Number(data.quantity),
//     orderPrice: totalPrice,
//     firstName: data.firstName,
//     lastName: data.lastName,
//     contactNumber: data.contactNumber,
//     deliveryAddress: data.deliveryAddress,
//     notes: data.notes,
//     status: "pending",
//     paymentOption: product.paymentOption,
//     paymentStatus: product.paymentOption === "cod" ? "cod" : "pending",
//     createdAt: new Date(),
//     buyer: {
//       email: user.email,
//       displayName: user.displayName,
//       photoURL: user.photoURL,
//     },
//   };
//   console.log(orderData, product);

//   // Swal confirm
//   const confirmResult = await Swal.fire({
//     title: "do you want to confirm this order?",
//     text: 'you can"t back this page after confirm this order',
//     icon: "question",
//     showDenyButton: true,
//     showCancelButton: true,
//     confirmButtonText: "yes confirm",
//     denyButtonText: "No",
//   });

//   if (!confirmResult.isConfirmed) {
//     Swal.fire("order has been cancelled", "", "info");
//     return;
//   }

//   try {
//     // 1. Advance/Stripe payment case
//     const sessionRes = await axiosSecure.post(
//       "/create-checkout-session",
//       orderData,
//     );

//     if (sessionRes.data.url) {
//       toast.info("পেমেন্ট পেজে রিডাইরেক্ট করা হচ্ছে...");
//       window.location.href = sessionRes.data.url;
//     } else {
//       throw new Error("পেমেন্ট সেশন তৈরি করতে ব্যর্থ");
//     }

//     // Swal success (পেমেন্ট complete হলে success page থেকে আসবে)
//     Swal.fire("সফল!", "অর্ডার কনফার্ম হয়েছে", "success");

//     // 2. COD case
//     if (product.paymentOption === "cod") {
//       toast.success("Order has been placed (Cash on Delivery)");
//       Swal.fire("Success!", "This Order has been Confirmed", "success");

//       return;
//     }

//     // 3. Save order in DB first
//     const orderRes = await axiosSecure.post("/orders", orderData);

//     if (!orderRes.data.insertedId) {
//       toast.error("অর্ডার সেভ করতে ব্যর্থ");
//     }
//   } catch (err) {
//     console.error("Order submission error:", err);
//     toast.error("অর্ডার প্লেস করতে সমস্যা হয়েছে: " + (err.message || ""));
//   }
// };

// app.post("/verify-payment", async (req, res) => {
//       const sessionId = req.query.session_id;

//       const session =
//         await stripeInstance.checkout.sessions.retrieve(sessionId);

//       const trackingId = generateTrackingId();
//       const transactionId = session.payment_intent;
//       const query = { transactionId: transactionId };

//       const product = await productCollection.findOne({
//         _id: new ObjectId(session.metadata.orderId),
//       });

//       console.log("from product", product);

//       if (session.payment_status === "paid") {
// if (session.payment_status === "paid") {
//         await orderCollection.updateOne(
//           { _id: new ObjectId(session.metadata.orderId) },
//           {
//             $set: {

//               status: "pending",
//               paymentStatus: "paid",
//               paidAt: new Date(),
//             },
//           },
//         );
//         const paymentDetails = {
//           amount: session.amount_total / 100,
//           product: product.productName,
//           orderQuantity: product.minOrderQuantity,
//           currency: session.currency,
//           customerEmail: session.customer_email,
//           buyer_email: session.metadata.buyer,
//           orderId: session.metadata.orderId,
//           status: "pending",
//           paymentStatus: "paid",
//           transactionId: session.payment_intent,
//           paymentStatus: session.payment_status,
//           trackingId: trackingId,
//           paidAt: new Date(),
//         };
//         console.log("payment details", paymentDetails);

//         const paymentExist = await paymentCollection.findOne(query)
//         if (paymentExist) {
//           return res.send({
//             message: "already exist",
//             transactionId, trackingId
//           })
//         }
