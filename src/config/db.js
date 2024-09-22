import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    console.log("connecting...");
    const conn = await mongoose.connect(`${process.env.MONGODB_URL}${DB_NAME}`);
    console.log("Connected to MongoDB , Host : ", conn.connection.host);
  } catch (error) {
    console.log("Error in Connecting with DB : ", error);
    process.exit(1);
  }
};

export default connectDB;
