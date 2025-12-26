const mongoose = require("mongoose");
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },

    // Referral Code
    referralCode: { 
      type: String, 
      unique: true,
      sparse: true // Allows null values, uniqueness only on non-null
    },
    
    // Subscription Data
    subscription: {
      isActive: { type: Boolean, default: false },
      purchaseDate: { type: Date },
      expiryDate: { type: Date },
      amountPaid: { type: Number, default: 0 },
      subscriptionId: { type: String } // For payment reference
    },

    // Referral System
    referral: {
      referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Who referred this user
      level1: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Direct Referrals (20%)
      level2: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (12%)
      level3: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (10%)
      level4: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (8%)
      level5: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (7%)
      level6: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (2%)
      level7: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (2%)
      level8: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (2%)
      level9: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (2%)
      level10: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Indirect (2%)

      earningsByLevel: {
        level1: { type: Number, default: 0 },  // 20%
        level2: { type: Number, default: 0 },  // 12%
        level3: { type: Number, default: 0 },  // 10%
        level4: { type: Number, default: 0 },  // 8%
        level5: { type: Number, default: 0 },  // 7%
        level6: { type: Number, default: 0 },  // 2%
        level7: { type: Number, default: 0 },  // 2%
        level8: { type: Number, default: 0 },  // 2%
        level9: { type: Number, default: 0 },  // 2%
        level10: { type: Number, default: 0 }  // 2%
      },
      totalEarnings: { type: Number, default: 0 }
    },

    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user'
    },
    
    permissions: {
      manageUsers: { type: Boolean, default: false },
      manageProducts: { type: Boolean, default: false },
      manageCategories: { type: Boolean, default: false },
      manageOrders: { type: Boolean, default: false },
      manageSubscriptions: { type: Boolean, default: false },
      manageWithdrawals: { type: Boolean, default: false },
      viewReports: { type: Boolean, default: false },
      viewDashboard: { type: Boolean, default: true }
    },

    // Withdrawal Data
    withdrawals: {
      pendingRequest: { type: Boolean, default: false },
      totalWithdrawn: { type: Number, default: 0 },
      requestedAt: { type: Date },
      amount: { type: Number },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      bankAccount: {
        accountNumber: String,
        bankName: String,
        accountHolder: String
      },
      history: [{
        amount: Number,
        status: { type: String, enum: ['approved', 'rejected'] },
        requestedAt: Date,
        processedAt: Date,
        adminNote: String
      }]
    },

    // new: points balance and watched video history
    pointsBalance: { type: Number, default: 0 },
    watchedVideos: [
      {
        video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
        points: { type: Number, default: 0 },
        credited: { type: Boolean, default: false },
        watchedAt: { type: Date }
      }
    ],
    // 7-Day Challenge tracking
    challenge: {
      currentDay: { type: Number, default: 1, min: 1, max: 7 },
      lastClaimedAt: { type: Date, default: null },
      isActive: { type: Boolean, default: false }, // enabled for subscribed users
      completedDays: [{ type: Date }], // timestamps of successful daily claims
      totalChallengePoints: { type: Number, default: 0 }
    },
    

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Generate unique referral code for a user
userSchema.methods.generateReferralCode = function() {
  // Create a code based on user ID and a random string
  const randomString = crypto.randomBytes(4).toString('hex').toUpperCase();
  this.referralCode = `${this.username.substring(0, 3).toUpperCase()}${randomString}`;
  return this.referralCode;
};

// Check if referral code is valid
userSchema.methods.hasValidReferralCode = function() {
  return this.subscription.isActive && 
         this.subscription.expiryDate > new Date() &&
         this.referralCode;
};

module.exports = mongoose.model("User", userSchema);
