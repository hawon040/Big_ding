const mongoose = require("mongoose");

const inquirySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, enum: ["pending", "resolved"], default: "pending" },
}, { timestamps: true });

module.exports = mongoose.model("Inquiry", inquirySchema);