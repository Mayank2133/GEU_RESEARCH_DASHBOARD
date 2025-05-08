# GEU Login System

## 📌 Project Overview
This is a **Login & Registration System** built with **HTML, CSS, JavaScript, and Node.js**. The system allows users to **register** and **log in**, storing user data in a JSON file. The staff dashboard displays user details upon successful login.

## 🚀 Features
- **User Registration**: Users can sign up with an email and password.
- **Login Authentication**: Validates user credentials against stored data.
- **Data Persistence**: Stores registered users in a JSON file.
- **Secure Password Handling**: Enforces password constraints (uppercase, special character, and length).
- **Dynamic Dashboard**: Displays user information upon login.

## 📂 Folder Structure
```
/geu-login
├── public
│   ├── index.html          # Homepage
│   ├── register.html       # User Registration Page
│   ├── login.html          # User Login Page
│   ├── staff-dashboard.html # Dashboard for logged-in users
│   ├── assets/             # CSS, JS, Images
│
├── user_auth
│   ├── users.json          # Stores registered users
│   ├── server.js           # Node.js backend
│
├── .gitignore              # Excludes node_modules & logs
├── package.json            # Node.js dependencies
├── README.md               # Project documentation
```

## 🛠️ Setup Instructions

### 1️⃣ Install Dependencies
Ensure **Node.js** is installed, then run:
```sh
npm install
```

### 2️⃣ Start the Server
```sh
node server.js
```
The server runs on **http://localhost:4000/**

### 3️⃣ Open the App
- Open `http://localhost:4000/register.html` to register a user.
- Open `http://localhost:4000/login.html` to log in.
- If login is successful, you'll be redirected to `staff-dashboard.html`.

## 📜 API Endpoints
| Method | Endpoint      | Description |
|--------|-------------|-------------|
| POST   | /register   | Registers a new user |
| POST   | /login      | Authenticates a user |
| GET    | /dashboard  | Fetches user details |

## 📌 Future Enhancements
- Implement **MongoDB** for user authentication.
- Add **JWT authentication** for better security.
- Improve UI with Bootstrap & animations.

## 👨‍💻 Author
[Mayank] - Developed as part of a learning project.

---
### 🎯 If you found this useful, don't forget to ⭐ the repo!

