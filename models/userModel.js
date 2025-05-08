const fs = require("fs");
const path = require("path");

const usersFilePath = path.join(__dirname, "..", "users.json");

// Ensure users.json exists
if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, JSON.stringify([]));
}

// Internal read/write
const readUsers = () => JSON.parse(fs.readFileSync(usersFilePath));
const writeUsers = (users) => fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

// Exported functions
module.exports = {
    getAllUsers: () => readUsers(),

    getUserByEmail: (email) => {
        const users = readUsers();
        return users.find(user => user.email === email);
    },

    userExists: (email) => {
        const users = readUsers()
        return users.some(user => user.email === email);
    },

    updateUser: (email, newData) => {
        const users = this.getAllUsers();
        const index = users.findIndex(u => u.email === email);
        
        if (index !== -1) {
            users[index] = { ...users[index], ...newData };
            fs.writeFileSync(
                path.join(__dirname, 'users.json'),
                JSON.stringify(users, null, 2)
            );
            return true;
        }
        return false;
    },

    createUser: (newUser) => {

        
        const users = readUsers();
        newUser.remainingResearchGrant = 20000; // default limit
        newUser.remainingJournalGrant = 30000;
        newUser.lastGrantYear = new Date().getFullYear();
        users.push(newUser);
        writeUsers(users);
    }
};
