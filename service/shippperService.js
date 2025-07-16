const Account = require("../models/Account");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { storage } = require("../config/firebase"); // Import the storage instance
const { ref, uploadBytes, getDownloadURL } = require("firebase/storage"); // Import Firebase v

const getShippers = async () => {
  try {
    const shippers = await Account.find({ role: "shipper" }).select("-password");
    return shippers;
  } catch (error) {
    throw new Error("Failed to retrieve shippers: " + error.message);
  }
};

const assignShipper = async (orderId, shipperId) => {
  try {
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("Invalid order ID");
    }
    if (!mongoose.Types.ObjectId.isValid(shipperId)) {
      throw new Error("Invalid shipper ID");
    }

    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Check if shipper exists and has shipper role
    const shipper = await Account.findOne({ _id: shipperId, role: "shipper" });
    if (!shipper) {
      throw new Error("Shipper not found or not a valid shipper");
    }

    // Update order with shipper assignment
    order.assignToShipper = shipperId;
    await order.save();

    // Populate shipper details for response
    const updatedOrder = await Order.findById(orderId)
      .populate("accountId", "fullName email")
      .populate("assignToShipper", "fullName email");

    return updatedOrder;
  } catch (error) {
    throw new Error("Failed to assign shipper: " + error.message);
  }
};

const getAssignedOrders = async (shipperId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(shipperId)) {
      throw new Error("Invalid shipper ID");
    }

    const orders = await Order.find({ assignToShipper: shipperId })
      .populate("accountId", "fullName email")
      .populate("assignToShipper", "fullName email");

    return orders;
  } catch (error) {
    throw new Error("Failed to retrieve assigned orders: " + error.message);
  }
};

const completeDelivery = async (orderId, shipperId, file) => {
  try {
    // Validate order ID
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("Invalid order ID");
    }

    // Check if order exists and is assigned to the shipper
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    if (order.assignToShipper.toString() !== shipperId) {
      throw new Error("Forbidden: Order not assigned to this shipper");
    }

    // Upload image to Firebase Storage
    const fileName = `proofs/${orderId}_${Date.now()}_${file.originalname}`;
    const storageRef = ref(storage, fileName);
    const metadata = {
      contentType: file.mimetype,
    };
    await uploadBytes(storageRef, file.buffer, metadata);
    const downloadURL = await getDownloadURL(storageRef);

    // Update order
    order.certificationComplete = downloadURL;
    order.status = "delivered";
    order.paidAt = new Date();
    await order.save();

    // Populate details for response
    const updatedOrder = await Order.findById(orderId)
      .populate("accountId", "fullName email")
      .populate("assignToShipper", "fullName email");

    return updatedOrder;
  } catch (error) {
    throw new Error("Failed to complete delivery: " + error.message);
  }
};

module.exports = {
  getShippers,
  assignShipper,
  getAssignedOrders,
  completeDelivery,
};
