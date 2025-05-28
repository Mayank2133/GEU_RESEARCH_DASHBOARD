const mongoose = require("mongoose");

// Define the schema
const submissionSchema = new mongoose.Schema({
    user: {
        name: String,
        email: String,
        phno: String
    },
    submissionType: { type: String, required: true }, // 'research' or 'journal'

    title: String,
    conference: {
        name: String,
        date: Date,
        venue: String,
        lastDate: Date
    },

    bank: {
        name: String,
        accountNumber: String,
        ifsc: String
    },

    charges: {
        registrationFee: Number,
        travel: Number,
        accommodation: Number,
        food: Number,
        other: Number
    },

    coAuthors: [String],
    receiptUrl: String, // Cloudinary URL for uploaded PDF
    submissionDate: { type: Date, default: Date.now },
    status: { type: String, default: "pending" }
});

// Create the model
const Submission = mongoose.model("Submission", submissionSchema);

// Exported functions
module.exports = {
    saveSubmission: async (submissionData) => {
        const submission = new Submission(submissionData);
        await submission.save();
        return submission;
    },

    getUserSubmissions: async (email) => {
        return await Submission.find({ "user.email": email });
    },

    getAllSubmissions: async () => {
        return await Submission.find({});
    },

    getSubmissionModel: () => Submission // Optional: for direct model access
};
