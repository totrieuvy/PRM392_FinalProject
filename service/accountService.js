const Account = require("../models/Account");
const httpErrors = require("http-errors");
const bcrypt = require("bcryptjs");

const getAllAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({ _id: { $ne: req.userId }, isActive: true }).select("-password");
    res.status(200).json({
      status: 200,
      data: accounts,
    });
  } catch (error) {
    next(httpErrors.InternalServerError(error.message));
  }
};

const getAccountById = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id).select("-password");
    if (!account || !account.isActive) {
      return res.status(404).json({
        status: 404,
        message: "Account not found or inactive",
      });
    }
    res.status(200).json({
      status: 200,
      data: account,
    });
  } catch (error) {
    next(httpErrors.InternalServerError(error.message));
  }
};

const createAccount = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role, avatar } = req.body;

    // Check if email or phone already exists
    const existingAccount = await Account.findOne({ $or: [{ email }, { phone }] });
    if (existingAccount) {
      return res.status(400).json({
        status: 400,
        message: "Email or phone already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newAccount = new Account({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: role || "user",
      avatar,
      isActive: true,
    });

    await newAccount.save();

    // Remove password from response
    const { password: _, ...accountData } = newAccount.toObject();

    res.status(201).json({
      status: 201,
      data: accountData,
    });
  } catch (error) {
    next(httpErrors.InternalServerError(error.message));
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role, avatar, isActive } = req.body;

    const account = await Account.findById(req.params.id);
    if (!account || !account.isActive) {
      return res.status(404).json({
        status: 404,
        message: "Account not found or inactive",
      });
    }

    // Check if email or phone is being updated to an existing one
    if (email || phone) {
      const existingAccount = await Account.findOne({
        $or: [{ email }, { phone }],
        _id: { $ne: req.params.id },
      });
      if (existingAccount) {
        return res.status(400).json({
          status: 400,
          message: "Email or phone already exists",
        });
      }
    }

    // Update fields
    if (fullName) account.fullName = fullName;
    if (email) account.email = email;
    if (phone) account.phone = phone;
    if (password) account.password = await bcrypt.hash(password, 10);
    if (role) account.role = role;
    if (avatar) account.avatar = avatar;
    if (isActive !== undefined) account.isActive = isActive;

    await account.save();

    // Remove password from response
    const { password: _, ...accountData } = account.toObject();

    res.status(200).json({
      status: 200,
      data: accountData,
    });
  } catch (error) {
    next(httpErrors.InternalServerError(error.message));
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account || !account.isActive) {
      return res.status(404).json({
        status: 404,
        message: "Account not found or already inactive",
      });
    }

    account.isActive = false;
    await account.save();

    res.status(200).json({
      status: 200,
      message: "Account deactivated successfully",
    });
  } catch (error) {
    next(httpErrors.InternalServerError(error.message));
  }
};

module.exports = {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
};
