const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config()
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = 9000;



app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.VITE_DB_USER}:${process.env.VITE_DB_PASS}@cluster0.ue9fgze.mongodb.net/?appName=Cluster0`;

console.log(uri);
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res)=>{
  res.send('app is running')
})  

async function run() {

  try {
    await client.connect();

    const db = client.db('myDb')
    const dataCollection =  db.collection('products-collection')

    app.get('/products-collection', async(req, res)=>{
      const result =await dataCollection.find().toArray()
      res.send(result)
    })
   
    // app.post('/products-collection', async(req, res)=>{
    //     const data = req.body
    //     const result = dataCollection.insertOne()
    // })


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);

app.listen(port, ()=>{
  console.log(`app running on this port ${port}`);
})  



