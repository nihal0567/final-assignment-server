const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config()
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = 9000;



app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.VITE_DB_USER}:${process.env.VITE_DB_PASS}@cluster0.ue9fgze.mongodb.net/?appName=Cluster0`;


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


    const db = client.db('myDb')
    const dataCollection =  db.collection('products-collection')
    const productCollection = db.collection('add-products')

     app.get('/products', async(req, res)=>{
      const query = {}
      const {email} = req.query
      // if (email) {
      //   query.user?.email = email
      // }
      const options = {sort: {createdAt: -1}}
      const result = await productCollection.find(query, options).toArray()
      res.send(result)
    })

     

    app.post('/products', async(req, res)=>{
      const productData = req.body;
      productData.createdAt = new Date()
      console.log(productData);
      const result = await productCollection.insertOne(productData)
      res.send(result)

    })

    app.patch('/products/:id', async(req, res)=>{
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id)}
      const update = {
        $set : updatedProduct
      }
      const result = await productCollection.updateOne(query, update)
      res.send(result)
    })
   
    app.delete('/products/:id', async(req, res)=>{
      const id = req.params.id;
      const query = { _id : new ObjectId(id)}
      const result = await productCollection.deleteOne(query)
      res.send(result)
    })








    app.get('/products-collection', async(req, res)=>{
      const result =await dataCollection.find().toArray()
      res.send(result)
    })
    app.get('/products-collection/:id',async(req, res)=>{
      const { id } = req.params
      console.log(id);
      const result = await dataCollection.findOne({_id: new ObjectId(id)})
      res.send({
        success: true,
        result
      })
    })
    app.get('/limit-products',async(req, res)=>{
      const result = await dataCollection.find().sort({price: 'asc'}).limit(6).toArray()
      console.log(result);
      res.send(result)
    })
    

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);

app.listen(port, ()=>{
  console.log(`app running on this port ${port}`);
})  



