const User = require("../models/User");
const bcrypt = require("bcrypt");
const { generateToken, verifyToken } = require("../utils/jwt");
const { updateReferralChain } = require("../utils/referralUtils");

// Register a new user
exports.register = async (req, res) => {
  try {
    const { name, username, email, password, referralCode } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: userExists.email === email 
          ? "Email is already registered" 
          : "Username is already taken"
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = await User.create({
      name,
      username,
      email,
      passwordHash,
      referral: {
        level1: [],
        level2: [],
        level3: [],
        level4: [],
        level5: [],
        level6: [],
        level7: [],
        level8: [],
        level9: [],
        level10: [],
        earningsByLevel: {
          level1: 0, level2: 0, level3: 0, level4: 0, level5: 0,
          level6: 0, level7: 0, level8: 0, level9: 0, level10: 0
        },
        totalEarnings: 0
      }
    });

    // Process referral code if provided
    if (referralCode) {
      await updateReferralChain(newUser._id, referralCode);
    }

    // Generate JWT token
    const token = generateToken(newUser._id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { login, username, password } = req.body;
    
    // Use login field if provided, otherwise fall back to username
    const userIdentifier = login || username;
    
    if (!userIdentifier) {
      return res.status(400).json({
        success: false,
        message: "Email or username is required"
      });
    }

    // Check if login is email or username
    const user = await User.findOne({
      $or: [{ email: userIdentifier.toLowerCase() }, { username: userIdentifier.toLowerCase() }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message
    });
  }
};

// Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile",
      error: error.message
    });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { name, email, username, currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Prepare update object
    const updateData = {};
    
    if (name) updateData.name = name;
    
    // Check if email is being changed
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already in use"
        });
      }
      updateData.email = email.toLowerCase();
    }
    
    // Check if username is being changed
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username, _id: { $ne: userId } });
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          message: "Username already taken"
        });
      }
      updateData.username = username.toLowerCase();
    }
    
    // Handle password update
    if (newPassword && currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect"
        });
      }
      
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(newPassword, salt);
    }
    
    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes to update"
      });
    }
    
    updateData.updatedAt = Date.now();
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-passwordHash");
    
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message
    });
  }
};

// Update bank account details
exports.updateBankDetails = async (req, res) => {
  try {
    const { accountNumber, bankName, accountHolder } = req.body;
    const userId = req.user.id;
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        "withdrawals.bankAccount": {
          accountNumber,
          bankName,
          accountHolder
        },
        updatedAt: Date.now()
      },
      { new: true }
    ).select("-passwordHash");
    
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Bank details updated successfully",
      bankAccount: updatedUser.withdrawals.bankAccount
    });
  } catch (error) {
    console.error("Update bank details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update bank details",
      error: error.message
    });
  }
};

// Request withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Check if bank details are provided
    if (!user.withdrawals.bankAccount.accountNumber ||
        !user.withdrawals.bankAccount.bankName ||
        !user.withdrawals.bankAccount.accountHolder) {
      return res.status(400).json({
        success: false,
        message: "Please update your bank details first"
      });
    }
    
    // Check if there's already a pending request
    if (user.withdrawals.pendingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending withdrawal request"
      });
    }
    
    // Check if user has earnings to withdraw
    if (user.referral.totalEarnings <= 0) {
      return res.status(400).json({
        success: false,
        message: "You don't have any earnings to withdraw"
      });
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        "withdrawals.pendingRequest": true,
        updatedAt: Date.now()
      },
      { new: true }
    ).select("-passwordHash");
    
    // In a real application, you would also create a withdrawal record in a separate collection
    
    res.status(200).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      withdrawalStatus: {
        pendingRequest: updatedUser.withdrawals.pendingRequest,
        totalEarnings: updatedUser.referral.totalEarnings
      }
    });
  } catch (error) {
    console.error("Withdrawal request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit withdrawal request",
      error: error.message
    });
  }
};

// Get referral statistics
exports.getReferralStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId)
      .select("referral")
      .populate("referral.level1", "name username")
      .populate("referral.level2", "name username")
      .populate("referral.level3", "name username")
      .populate("referral.level4", "name username")
      .populate("referral.level5", "name username");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Calculate referral counts
    const referralCounts = {
      level1: user.referral.level1.length,
      level2: user.referral.level2.length,
      level3: user.referral.level3.length,
      level4: user.referral.level4.length,
      level5: user.referral.level5.length,
      level6: user.referral.level6.length,
      level7: user.referral.level7.length,
      level8: user.referral.level8.length,
      level9: user.referral.level9.length,
      level10: user.referral.level10.length,
      total: user.referral.level1.length + user.referral.level2.length + 
             user.referral.level3.length + user.referral.level4.length + 
             user.referral.level5.length + user.referral.level6.length + 
             user.referral.level7.length + user.referral.level8.length + 
             user.referral.level9.length + user.referral.level10.length
    };
    
    res.status(200).json({
      success: true,
      referral: {
        earnings: user.referral.earningsByLevel,
        totalEarnings: user.referral.totalEarnings,
        directReferrals: user.referral.level1,
        referralCounts
      }
    });
  } catch (error) {
    console.error("Get referral stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve referral statistics",
      error: error.message
    });
  }
};