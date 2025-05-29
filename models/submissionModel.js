const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
    user: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true }
    },
    submissionType: { type: String, required: true, enum: ["research", "journal"] },
    title: { type: String, required: true },
    conference: {
        name: { type: String, required: true },
        date: { type: Date, required: true },
        venue: { type: String, required: true },
        lastDate: { type: Date, required: true }
    },
    bankDetails: {
        name: { type: String, required: true },
        accountNumber: { type: String, required: true },
        ifsc: { type: String, required: true }
    },
    charges: {
        registrationFee: { type: Number, required: true },
        travelCharges: { type: Number, required: true },
        lodgingCharges: { type: Number, required: true },
        totalAmount: { type: Number, required: true }
    },
    coAuthorCount: { type: Number, default: 0 },
    receiptUrl: { type: String, required: true }, // Cloudinary URL
    declaration: { type: Boolean, required: true },
    grantType: { type: String, required: true, enum: ["research", "journal"] },
    remainingBalanceAfter: { type: Number, required: true },
    status: { type: String, default: "pending" },
    submissionDate: { type: Date, default: Date.now }
}, { timestamps: true });

const Submission = mongoose.model("Submission", submissionSchema);

module.exports = {
    createSubmission: async (submissionData) => {
        const submission = new Submission(submissionData);
        return await submission.save();
    },
    getUserSubmissions: async (email) => {
        return await Submission.find({ "user.email": email }).sort({ createdAt: -1 });
    }
};