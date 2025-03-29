const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },

    // Subscription Data
    subscription: {
      isActive: { type: Boolean, default: false },
      purchaseDate: { type: Date },
      expiryDate: { type: Date },
      amountPaid: { type: Number, default: 0 }
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
      bankAccount: {
        accountNumber: { type: String, trim: true },
        bankName: { type: String, trim: true },
        accountHolder: { type: String, trim: true }
      },
      pendingRequest: { type: Boolean, default: false },
      lastWithdrawalDate: { type: Date },
      totalWithdrawn: { type: Number, default: 0 }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
