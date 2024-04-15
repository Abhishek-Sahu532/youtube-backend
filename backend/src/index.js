import 'dotenv/config'
import connectDB from "./db/db.js";
import { app } from './app.js';


// connecting database - receiving a promise
connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is running at port : ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log('MongoDB connection failed !!!', err)
})