const Account = require("../models/Account");

const profileService = {
  async getProfile(userId) {
    try {
      const account = await Account.findById(userId);
      if (!account) {
        throw new Error("Account not found");
      }
      return {
        fullName: account.fullName,
        email: account.email,
        phone: account.phone,
        avatar: account.avvatar,
        role: account.role,
      };
    } catch (error) {
      throw new Error("Failed to fetch profile: " + error.message);
    }
  },

  async updateProfile(userId, profileData) {
    try {
      const account = await Account.findById(userId);
      if (!account) {
        throw new Error("Account not found");
      }

      if (profileData.email && profileData.email === Account.email) {
        throw new Error("Email already exists");
      }

      if (profileData.phone && profileData.phone === account.phone) {
        throw new Error("Phone number already exists");
      }

      // Update only specified fields
      if (profileData.fullName !== undefined) {
        account.fullName = profileData.fullName;
      }
      if (profileData.email !== undefined) {
        account.email = profileData.email;
      }
      if (profileData.phone !== undefined) {
        account.phone = profileData.phone;
      }
      if (profileData.avatar !== undefined) {
        account.avatar = profileData.avatar;
      }

      await account.save();
      return {
        fullName: account.fullName,
        email: account.email,
        phone: account.phone,
        avatar: account.avvatar,
        role: account.role,
      };
    } catch (error) {
      throw new Error("Failed to update profile: " + error.message);
    }
  },
};

module.exports = profileService;
