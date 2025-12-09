const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = 9000;



app.use(cors())
app.use(express.json())

app.get('/', (req, res)=>{
  res.send('app is running')
})
app.listen(port, ()=>{
  console.log(`app running on this port ${port}`);
})

const uri = `mongodb+srv://${process.env.VITE_DB_USER}:${process.env.VITE_DB_PASS}@cluster0.ue9fgze.mongodb.net/?appName=Cluster0`;

// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });
// async function run() {

//   const db = client.db("myDb")
//   const dataCollection = db

//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();
//     // Send a ping to confirm a successful connection
//     await client.db("admin").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
//     // Ensures that the client will close when you finish/error
//     await client.close();
//   }
// }
// run().catch(console.dir);



