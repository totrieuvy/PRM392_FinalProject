const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const redis = require("redis");
const Account = require("../models/Account");
const fs = require("fs").promises;
const path = require("path");
const jwt = require("jsonwebtoken");

// Initialize Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

redisClient.on("connect", () => {
  console.log("Connected to Redis");
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
})();

// Initialize Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const authService = {
  async register({ fullName, email, phone, password }) {
    try {
      // Check if email or phone already exists
      const existingAccount = await Account.findOne({ $or: [{ email }, { phone }] });
      if (existingAccount) {
        throw new Error("Email or phone already registered");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new account (inactive until verified)
      const account = new Account({
        fullName,
        email,
        phone,
        password: hashedPassword,
        isActive: false,
      });
      await account.save();

      // Generate and store OTP
      const otp = generateOtp();
      try {
        await redisClient.setEx(`otp:${email}`, 600, otp); // 10 minutes TTL
      } catch (redisError) {
        throw new Error("Failed to store OTP in Redis: " + redisError.message);
      }

      // Read verification email template
      let template;
      try {
        template = await fs.readFile(path.join(__dirname, "../templates/verificationEmail.html"), "utf-8");
      } catch (fileError) {
        throw new Error("Failed to read email template: " + fileError.message);
      }

      // Replace placeholders in template
      const htmlContent = template.replace("{{fullName}}", fullName).replace("{{otp}}", otp);

      // Send verification email
      await transporter.sendMail({
        from: '"Blossom Flower Shop" <${process.env.EMAIL_USER}>',
        to: email,
        subject: "Verify Your Blossom Flower Shop Account 🌸",
        html: htmlContent,
      });

      return { email };
    } catch (error) {
      throw error;
    }
  },

  async verifyOtp(email, otp) {
    try {
      // Find account
      const account = await Account.findOne({ email });
      if (!account) {
        throw new Error("Account not found");
      }
      if (account.isActive) {
        throw new Error("Account already verified");
      }

      // Verify OTP
      let storedOtp;
      try {
        storedOtp = await redisClient.get(`otp:${email}`);
      } catch (redisError) {
        throw new Error("Failed to retrieve OTP from Redis: " + redisError.message);
      }

      if (!storedOtp || storedOtp !== otp) {
        throw new Error("Invalid or expired OTP");
      }

      // Activate account
      account.isActive = true;
      await account.save();

      // Delete OTP from Redis
      try {
        await redisClient.del(`otp:${email}`);
      } catch (redisError) {
        console.warn("Failed to delete OTP from Redis:", redisError);
      }
    } catch (error) {
      throw error;
    }
  },

  async resendOtp(email) {
    try {
      // Find account
      const account = await Account.findOne({ email });
      if (!account) {
        throw new Error("Account not found");
      }
      if (account.isActive) {
        throw new Error("Account already verified");
      }

      // Generate and store new OTP
      const otp = generateOtp();
      try {
        await redisClient.setEx(`otp:${email}`, 600, otp); // 10 minutes TTL
      } catch (redisError) {
        throw new Error("Failed to store new OTP in Redis: " + redisError.message);
      }

      // Read resend email template
      let template;
      try {
        template = await fs.readFile(path.join(__dirname, "../templates/resendOtpEmail.html"), "utf-8");
      } catch (fileError) {
        throw new Error("Failed to read resend email template: " + fileError.message);
      }

      // Replace placeholders in template
      const htmlContent = template.replace("{{fullName}}", account.fullName).replace("{{otp}}", otp);

      // Send resend email
      await transporter.sendMail({
        from: '"Blossom Flower Shop" <${process.env.EMAIL_USER}>',
        to: email,
        subject: "New OTP for Your Blossom Flower Shop Account 🌷",
        html: htmlContent,
      });
    } catch (error) {
      throw error;
    }
  },

  async login(email, password) {
    try {
      // Find account by email
      const account = await Account.findOne({ email });
      if (!account) {
        throw new Error("Invalid email or password");
      }
      if (!account.isActive) {
        throw new Error("Account not verified");
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, account.password);
      if (!isMatch) {
        throw new Error("Invalid email or password");
      }

      // Generate JWT token
      const token = jwt.sign({ id: account._id, role: account.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      });

      // Return user data with token
      return {
        id: account._id,
        fullName: account.fullName,
        email: account.email,
        phone: account.phone,
        role: account.role,
        token,
      };
    } catch (error) {
      throw error;
    }
  },
};

module.exports = authService;
