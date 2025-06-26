const mongoose = require("mongoose");

const flowerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
});

const Flower = mongoose.model("Flower", flowerSchema);

module.exports = Flower;
