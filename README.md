# GEU Research Dashboard 🎓📊

> A comprehensive research management system for Graphic Era University faculty, streamlining grant applications, submissions, and academic workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Available-success)](https://geu-research-dashboard-deloyable.onrender.com)
![Tech Stack](https://img.shields.io/badge/Stack-MERN-61DAFB?logo=react&logoColor=white)



## 🌟 Key Features

### 👨‍💻 Faculty Capabilities
- **Grant Management**  
  - Research (₹20,000) & Journal (₹30,000) grants with annual reset
  - Real-time balance tracking
- **Paper Submission System**
  - Research paper and journal submission workflows
  - Cloudinary-based PDF uploads
- **Personal Dashboard**
  - Profile management with image uploads
  - Submission history tracking
  - Contact information management

### ⚙️ Technical Highlights
- **Secure Authentication**
  - Session-based auth with bcrypt password hashing
  - Role-based access control
- **Document Management**
  - PDF validation and Cloudinary storage
  - Automatic file cleanup
- **Responsive Design**
  - Mobile-friendly dashboard with collapsible sidebar
  - Bootstrap 5 components with custom styling
- **Automated Grants System**
  - Yearly grant reset logic
  - Balance deduction on submission

## 🛠 Technology Stack

### Core Components
| Layer               | Technology               |
|---------------------|--------------------------|
| **Frontend**        | HTML5, Bootstrap 5, Vanilla JS |
| **Backend**         | Node.js, Express.js      |
| **Database**        | MongoDB (Mongoose ODM)   |
| **Authentication**  | Express-sessions, bcrypt |
| **Storage**         | Cloudinary (PDF/Images)  |
| **Security**        | reCAPTCHA v2             |

### Infrastructure
- **Hosting**: Render.com
- **Environment Management**: Dotenv
- **PDF Processing**: PDFKit
- **HTTP Client**: Axios

## 🚀 Deployment

The application is deployed on **Render.com** using:
- **Web Service**: Node.js environment
- **Database**: MongoDB Atlas cluster
- **Storage**: Cloudinary for media assets

**Live Demo**: [https://geu-research-dashboard-deloyable.onrender.com](https://geu-research-dashboard-deloyable.onrender.com)

## ⚙️ Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/Mayank2133/GEU_RESEARCH_DASHBOARD.git
   cd GEU_RESEARCH_DASHBOARD

2. **Install dependencies**
   ```bash
   npm install