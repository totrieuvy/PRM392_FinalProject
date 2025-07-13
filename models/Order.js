const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    orderAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
      required: true,
    },
    proofOfDelivery: {
      type: String,
      trim: true,
    },
    addressShip: {
      type: String,
      required: true,
      trim: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },
    paymentCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    assignToShipper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    certificationComplete: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);
