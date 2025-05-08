const fs = require("fs");
const path = require("path");

const submissionsFile = path.join(__dirname, "..", "submissions.json");

if (!fs.existsSync(submissionsFile)) {
    fs.writeFileSync(submissionsFile, JSON.stringify([]));
}

const readSubmissions = () => {
    try {
        return JSON.parse(fs.readFileSync(submissionsFile));
    } catch (error) {
        console.error("Error reading submissions:", error);
        return [];
    }
};

const writeSubmissions = (data) => {
    try {
        fs.writeFileSync(submissionsFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error writing submissions:", error);
    }
};

module.exports = {
    saveSubmission: (submission) => {
        const submissions = readSubmissions();
        submissions.push(submission);
        writeSubmissions(submissions);
        return submission; // Return the saved submission
    },

    getUserSubmissions: (email) => {
        const submissions = readSubmissions();
        return submissions.filter(sub => sub.user?.email === email);
        
        
    },

     // Add this helper function for debugging
    getAllSubmissions: () => {
        return readSubmissions();
    }

};
