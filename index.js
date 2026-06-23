const express = require('express');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');
const { connectDB } = require('./db');
require('dotenv').config()

const app = express()
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5000

app.get('/', (req, res) => {
  res.send('RecipeHub Server is running!')
})





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



// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server!' });
});

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })
});