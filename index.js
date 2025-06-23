var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");
require("dotenv").config();
const setupSwagger = require("./config/swagger");
const mongoose = require("mongoose");
const redis = require("redis");

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
  },
});

redisClient
  .connect()
  .then(() => console.log("✅ Connected to Redis via Upstash"))
  .catch(console.error);

//import routes
const authRoutes = require("./routes/authRoutes");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

setupSwagger(app);

//define routes
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Hello world PRM392");
});

const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
