const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema({
  groupChat: { type: mongoose.Schema.Types.ObjectId, ref: "GroupChat", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "" },
  image: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("GroupMessage", groupMessageSchema);
