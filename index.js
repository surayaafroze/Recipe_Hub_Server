const express = require('express');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const app = express()
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000
require('dotenv').config()


const { MongoClient, ServerApiVersion } = require('mongodb');

app.get('/', (req, res) => {
  res.send('Hello World!')
})



const uri = process.env.MONGO_DB_URI

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const jwks = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}`))
const verifyToken=async(req,res,next)=>{
  const authHeader=req.headers.authorization;
  if(!authHeader || !authHeader.startsWith('Bearer ') ){
    return res.status(401).json({msg:"unauthorized"})
  }
  const token = authHeader.split(' ')[1]
  if(!token){
    return res.status(401).json({msg:"unauthorized"})
  }
  try{
const {payload}=await jwtVerify(token,jwks)

  }catch(error){
 return res.status(401).json({msg:"unauthorized"})
  }}



async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

const database = client.db("sample_mflix");
    const movies = database.collection("movies");



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);




// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server!' });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})