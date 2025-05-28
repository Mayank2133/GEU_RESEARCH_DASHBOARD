const mongoose = require("mongoose");

// Define the schema
const userSchema = new mongoose.Schema({
    role: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    designation: { type: String, required: true },
    phno: { type: String, required: true },
    password: { type: String, required: true },

    remainingResearchGrant: { type: Number, default: 20000 },
    remainingJournalGrant: { type: Number, default: 30000 },
    lastGrantYear: { type: Number, default: new Date().getFullYear() },
    profilePicture: { type: String } // Cloudinary URL
});

// Create a model from the schema
const User = mongoose.model("User", userSchema);

// Exported functions
module.exports = {
    getAllUsers: async () => {
        return await User.find({});
    },

    getUserByEmail: async (email) => {
        return await User.findOne({ email });
    },

    userExists: async (email) => {
        const user = await User.findOne({ email });
        return !!user;
    },

    updateUser: async (email, newData) => {
        const user = await User.findOneAndUpdate({ email }, newData, { new: true });
        return !!user;
    },

    createUser: async (newUser) => {
        const user = new User({
            ...newUser,
            remainingResearchGrant: 20000,
            remainingJournalGrant: 30000,
            lastGrantYear: new Date().getFullYear()
        });
        await user.save();
    },

    getUserModel: () => User // Optional: for direct model access
};



