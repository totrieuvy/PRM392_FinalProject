const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
    },
    avvatar: {
      type: String,
      default: "https://cdn0.iconfinder.com/data/icons/set-ui-app-android/32/8-512.png",
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "user", "shipper"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Account = mongoose.model("Account", accountSchema);

module.exports = Account;
