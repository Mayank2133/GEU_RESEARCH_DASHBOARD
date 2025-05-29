require("dotenv").config();
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


const express = require('express');
const session = require('express-session');
const memorystore = require('memorystore')(session);
// Add at the top with other requires
const cors = require('cors');
const fs = require("fs");
const bodyParser = require("body-parser");
const path = require("path");
const PDFDocument = require("pdfkit");
const axios = require("axios");

const bcrypt = require("bcrypt");

// 2. Initialize Express FIRST
const app = express();

// 2. THEN add CORS middleware

app.use(cors({
  origin: [
    'http://localhost:4000',
    'https://geu-research-dashboard-deloyable.onrender.com'
  ],
  credentials: true
}));


const userModel = require("./models/userModel"); //  NEW import
const submissionModel = require("./models/submissionModel");


app.use(session({
  store: new MemoryStore({
    checkPeriod: 86400000 // Prune expired entries every 24h
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // prevents client-side JS from accessing the cookie
    secure: process.env.NODE_ENV === 'production', // only send cookie over HTTPS in production
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict', // cross-origin handling
    maxAge: 86400000 // 24 hours
  }
}));




// Add multer for file uploads at the top
const multer = require('multer');
// Replace your current multer configuration with this:
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        // More lenient PDF detection
        if (file.mimetype === 'application/pdf' || 
            file.mimetype === 'application/octet-stream' ||
            path.extname(file.originalname).toLowerCase() === '.pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1
    },
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, 'uploads');
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `${req.session.user?.email || 'anonymous'}-${uniqueSuffix}${path.extname(file.originalname)}`);
        }
    })
});

const profileUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, 'uploads/profile-pictures');
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            cb(null, `profile-${uniqueSuffix}${ext}`);
        }
    }),
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});






const SUBMISSIONS_FOLDER = path.join(__dirname, 'submissions');
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;


if (!fs.existsSync(SUBMISSIONS_FOLDER)) {
    fs.mkdirSync(SUBMISSIONS_FOLDER, { recursive: true });
}


const PORT = process.env.PORT||4000;

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/profile-pictures', express.static(path.join(__dirname, 'uploads', 'profile-pictures')));

// Middleware

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));



// Register User Route
app.post("/register", async (req, res) => {
    const { role, email, name, designation, phno, password } = req.body;

    try {
        const exists = await userModel.userExists(email);
        if (exists) {
            return res.status(400).json({ message: "User already exists!" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await userModel.createUser({
            role,
            email,
            name,
            designation,
            phno,
            password: hashedPassword
        });

        res.status(201).json({ message: "User registered successfully!" });
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ message: "Server error during registration." });
    }
});

// ✅ Login User Route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await userModel.getUserByEmail(email);

        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                req.session.user = {
                    email: user.email,
                    role: user.role,
                    name: user.name,
                    designation: user.designation,
                    phno: user.phno,
                    remainingResearchGrant: user.remainingResearchGrant,
                    remainingJournalGrant: user.remainingJournalGrant
                };

                return res.json({ success: true, message: "Login successful!", role: user.role });
            }
        }

        res.status(401).json({ success: false, message: "Invalid credentials!" });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error during login." });
    }
});

//captcha key serve
app.get('/config', (req, res) => {
    res.json({ recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY });
});


// ✅ Logout
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Logout failed" });
        }
        res.clearCookie("connect.sid");
        return res.json({ success: true, message: "Logged out successfully" });
    });
});

app.get("/api/user", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    try {
        const user = await userModel.getUserByEmail(req.session.user.email);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.json({
            success: true,
            user: {
                name: user.name,
                email: user.email,
                role: user.role,
                designation: user.designation,
                phno: user.phno,
                remainingResearchGrant: user.remainingResearchGrant,
                remainingJournalGrant: user.remainingJournalGrant,
                lastGrantYear: user.lastGrantYear,
                profileUrl: user.profilePicture || null
            }
        });
    } catch (err) {
        console.error("Session fetch error:", err);
        res.status(500).json({ success: false, message: "Server error retrieving user." });
    }
});





// ✅ Dashboard session check
app.get('/staff-dashboard', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'staff-dashboard.html'));
    } else {
        res.redirect('/login');
    }
});

// Add profile picture upload endpoint (with other API routes)
// multer config for profileUpload (as before, storing to /uploads/profile-pictures)
app.post('/api/upload-profile', profileUpload.single('profilePic'), async (req, res) => {
  try {
    if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

    if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const filePath = req.file.path;
    // Upload to Cloudinary (folder "geu-profiles")
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'geu-profiles',
      resource_type: 'image'  // default for images
    });
    // Remove local file
    fs.unlinkSync(filePath);
    // Save URL to user profile in DB
    const updated = await User.findOneAndUpdate(
      { email: req.session.user.email },
      { profilePicUrl: result.secure_url },
      { new: true }
    );
    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});


// Add profile picture serving route (with other static routes)
app.get('/uploads/profile-pictures/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads/profile-pictures', req.params.filename);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ success: false, message: "Profile picture not found" });
    }
});


// Helper function for grant logic
const handleGrantRequest = (email, grantType, defaultAmount) => {
    const user = userModel.getUserByEmail(email);
    if (!user) {
        return { success: false, message: "User not found" };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const grantField = `remaining${grantType}Grant`;

    // Reset grant if new year
    if (user.lastGrantYear !== currentYear) {
        user[grantField] = defaultAmount;
        user.lastGrantYear = currentYear;

        // Update user data
        const users = userModel.getAllUsers();
        const index = users.findIndex(u => u.email === email);
        if (index !== -1) {
            users[index] = user;
            try {
                fs.writeFileSync(
                    path.join(__dirname, "..", "users.json"), 
                    JSON.stringify(users, null, 2)
                );
            } catch (error) {
                console.error("Error saving user data:", error);
                return { 
                    success: false, 
                    message: "Error updating user record" 
                };
            }
        }
    }

    return { 
        success: true, 
        remainingGrant: user[grantField],
        user // Return user object for potential additional processing
    };
};

// Research grant endpoint
app.get("/api/user-remaining-grant-research", (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: "Email parameter is required" 
        });
    }

    const result = handleGrantRequest(email, "Research", 20000);
    if (!result.success) {
        return res.status(404).json(result);
    }

    res.json({
        success: true,
        remainingGrant: result.remainingGrant,
        message: "Research grant information retrieved successfully"
    });
});

// Journal grant endpoint
app.get("/api/user-remaining-grant-journal", (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: "Email parameter is required" 
        });
    }

    const result = handleGrantRequest(email, "Journal", 30000);
    if (!result.success) {
        return res.status(404).json(result);
    }

    res.json({
        success: true,
        remainingGrant: result.remainingGrant,
        message: "Journal grant information retrieved successfully"
    });
});

app.post("/Submit-Grant", upload.single('customFile'), (req, res) => {

    try {

        const { submissionType } = req.body;
        const isResearch = submissionType === "research";
        const prefix = isResearch ? "research_" : "journal_";

        // Get email from session or form data
        const email = req.session.user?.email || req.body[`${prefix}email`];
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: "Email is required" 
            });
        }

        // Validate file was uploaded
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "PDF file is required" 
            });
        }


        // Get total grant amount
        const tga = parseFloat(req.body[`${prefix}tga`]) || 0;
        

        // Extract all fields with appropriate prefixes
        const submissionData = {
            // Basic info
            email: req.body[`${prefix}email`],
            name: req.body[`${prefix}name`],
            phone: req.body[`${prefix}tel`],
            
            // Conference/Journal info
            conferenceName: req.body[`${prefix}conference_name`],
            conferenceDate: req.body[`${prefix}conference_date`],
            venue: req.body[`${prefix}venue`],
            lastdate: req.body[`${prefix}last_date`],
            paperTitle: req.body[`${prefix}paper_title`],
            coauthor: req.body[`${prefix}coauthor_count`],
            
            // Bank details
            bankDetails: {
                name: req.body[`${prefix}bank_name`],
                accountNumber: req.body[`${prefix}account_number`],
                ifsc: req.body[`${prefix}ifsc`]
            },
            
            // Charges
            charges: {
                registrationFee: parseFloat(req.body[`${prefix}rf`]) || 0,
                travelCharges: parseFloat(req.body[`${prefix}tc`]) || 0,
                lodgingCharges: parseFloat(req.body[`${prefix}lc`]) || 0,
                totalAmount: tga
            },
            
            // Other fields
            declaration: req.body[`${prefix}dec`] === "on",
            filePath: req.file ? req.file.path : null,
            timestamp: new Date().toISOString(),
            status: "pending"
        };



        const file = req.file; // The uploaded file

        // Validate required fields
        if (!submissionType || !email || !tga) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required fields" 
            });
        }

        // Validate charges add up
        const calculatedTotal = submissionData.charges.registrationFee + 
                            submissionData.charges.travelCharges + 
                            submissionData.charges.lodgingCharges;
        
        if (Math.abs(calculatedTotal - submissionData.charges.totalAmount) > 0.01) {
            return res.status(400).json({
                success: false,
                message: "Total amount doesn't match sum of individual charges"
            });
        }


        const users = userModel.getAllUsers();
        const userIndex = users.findIndex(u => u.email === email);
        if (userIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        const user = users[userIndex];
        const now = new Date();
        const currentYear = now.getFullYear();
        const amountRequested = submissionData.charges.totalAmount;

        if (isResearch) {
            if (user.lastGrantYear !== currentYear) {
                user.remainingResearchGrant = 20000;
                user.lastGrantYear = currentYear;
            }
            if (user.remainingResearchGrant < amountRequested) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Requested amount exceeds your remaining research grant of ₹${user.remainingResearchGrant}` 
                });
            }
            user.remainingResearchGrant -= amountRequested;
        } else {
            if (user.lastGrantYear !== currentYear) {
                user.remainingJournalGrant = 30000;
                user.lastGrantYear = currentYear;
            }
            if (user.remainingJournalGrant < amountRequested) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Requested amount exceeds your remaining journal grant of ₹${user.remainingJournalGrant}` 
                });
            }
            user.remainingJournalGrant -= amountRequested;
        }

        // Update user data
        users[userIndex] = user;
        fs.writeFileSync(path.join(__dirname, "..", "users.json"), JSON.stringify(users, null, 2));



        

        // Save submission with comprehensive data
        const submissionDetails = {
            submissionType,
            user: {
                
                email: submissionData.email,
                name: submissionData.name
            },
            researchDetails: {
                title: submissionData.paperTitle,
                conference: submissionData.conferenceName,
                date: submissionData.conferenceDate,
                venue: submissionData.venue,
                coAuthors: submissionData.coauthor || [] // If you implement co-author handling
            },
            financials: {
                registrationFee: submissionData.charges.registrationFee,
                travelCharges: submissionData.charges.travelCharges,
                lodgingCharges: submissionData.charges.lodgingCharges,
                totalAmount: submissionData.charges.totalAmount,
                grantType: isResearch ? 'research' : 'journal',
                remainingBalance: isResearch ? 
                    user.remainingResearchGrant : 
                    user.remainingJournalGrant
            },
            bankDetails: submissionData.bankDetails,
            files: {
                receiptPath: submissionData.filePath,
                originalName: req.file?.originalname || null
            },
            declaration: {
                accepted: submissionData.declaration,
                timestamp: new Date().toISOString()
            },
            metadata: {
                status: 'pending', // Initial status
                submittedAt: new Date().toISOString()
            
            }
        };


        const savedSubmission = submissionModel.saveSubmission(submissionDetails);

        return res.status(200).json({ 
            success: true, 
            message: submissionType === "research" 
                ? `Research grant approved. Remaining: ₹${user.remainingResearchGrant}`
                : `Journal grant approved. Remaining: ₹${user.remainingJournalGrant}`,
            remainingGrant: submissionType === "research" 
                ? user.remainingResearchGrant 
                : user.remainingJournalGrant
        });

    } catch (error) {
        console.error("Submission error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error during submission" 
        });
    }

    


});

// Add endpoint to serve uploaded files
app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});  

app.get("/api/user-submissions", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const email = req.session.user.email;
    const userSubmissions = submissionModel.getUserSubmissions(email);
    res.json({ success: true, submissions: userSubmissions });
});

//pdf
app.get("/download-submission/:timestamp", (req, res) => {
    const { timestamp } = req.params;
    const all = submissionModel.getUserSubmissions(req.session.user.email);
    const submission = all.find(s => s.timestamp === timestamp);

    if (!submission) return res.status(404).send("Submission not found");

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${submission.submissionType}-submission-${timestamp}.pdf`);
    doc.pipe(res);

    // PDF Styling
    const titleSize = 16;
    const sectionSize = 14;
    const normalSize = 12;
    const margin = 50;
    const lineHeight = 20;

    // Header
    doc.fontSize(titleSize).text(`${submission.submissionType === 'research' ? 'Research Paper' : 'Journal'} Submission Receipt`, {
        underline: true,
        align: 'center'
    });
    doc.moveDown(2);

    // Submission Type and Date
    doc.fontSize(normalSize)
       .text(`Submission Type: ${submission.submissionType === 'research' ? 'Research Paper' : 'Journal'}`);
    doc.text(`Submission Date: ${new Date(submission.timestamp).toLocaleString()}`);
    doc.moveDown();

    // Personal Information Section
    doc.fontSize(sectionSize).text('1. Personal Information', { underline: true });
    doc.fontSize(normalSize)
       .text(`Name: ${submission.name}`)
       .text(`Email: ${submission.email}`)
       .text(`Phone: ${submission.phone}`);
    doc.moveDown();

    // Conference/Journal Information
    doc.fontSize(sectionSize).text(`2. ${submission.submissionType === 'research' ? 'Conference' : 'Journal'} Information`, { underline: true });
    doc.fontSize(normalSize)
       .text(`${submission.submissionType === 'research' ? 'Conference' : 'Journal'} Name: ${submission.conferenceName}`)
       .text(`Date: ${submission.conferenceDate}`)
       .text(`Venue: ${submission.venue}`)
       .text(`Paper Title: ${submission.paperTitle}`);
    doc.moveDown();

    // Bank Details
    doc.fontSize(sectionSize).text('3. Bank Details', { underline: true });
    doc.fontSize(normalSize)
       .text(`Account Holder: ${submission.bankDetails.name}`)
       .text(`Account Number: ${submission.bankDetails.accountNumber}`)
       .text(`IFSC Code: ${submission.bankDetails.ifsc}`);
    doc.moveDown();

    // Charges Breakdown
    doc.fontSize(sectionSize).text('4. Charges Breakdown', { underline: true });
    doc.fontSize(normalSize)
       .text(`Registration Fee: ₹${submission.charges.registrationFee}`)
       .text(`Travelling Charges: ₹${submission.charges.travelCharges}`)
       .text(`Lodging Charges: ₹${submission.charges.lodgingCharges}`)
       .moveDown()
       .font('Helvetica-Bold')
       .text(`Total Grant Amount: ₹${submission.charges.totalAmount}`, { align: 'right' })
       .font('Helvetica');
    doc.moveDown();

    // Declaration
    doc.fontSize(sectionSize).text('5. Declaration', { underline: true });
    doc.fontSize(normalSize)
       .text('I hereby declare that:')
       .text('• The above said research work is original and not published elsewhere')
       .text(`• Declaration Status: ${submission.declaration ? 'Accepted' : 'Not Accepted'}`);
    doc.moveDown();

    // File Attachment Note
    if (submission.filePath) {
        doc.fontSize(sectionSize).text('6. Attachments', { underline: true });
        doc.fontSize(normalSize)
           .text('All required documents are attached in the submission package.')
           .text(`File: ${path.basename(submission.filePath)}`);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(10)
       .text('This is an auto-generated submission receipt.', { align: 'center' })
       .text('Please contact the research department for any queries.', { align: 'center' });

    doc.end();
}); 



// ✅ Serve HTML Pages
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "register.htm")));
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/dashboard", (req, res) => res.sendFile(path.join(__dirname, "public", "staff-dashboard.html")));

// ✅ Google reCAPTCHA
app.post("/verify-recaptcha", async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, error: "No reCAPTCHA token provided" });
    }

    try {
        const response = await axios.post(
            "https://www.google.com/recaptcha/api/siteverify",
            null,
            {
                params: {
                    secret: process.env.RECAPTCHA_SECRET_KEY,
                    response: token
                }
            }
        );

        if (!response.data.success) {
            return res.status(400).json({
                success: false,
                message: "reCAPTCHA verification failed!",
                errors: response.data["error-codes"]
            });
        }

        res.json({ success: true, message: "reCAPTCHA verified!" });
    } catch (error) {
        console.error("reCAPTCHA verification error:", error);
        res.status(500).json({ success: false, message: "Server error during reCAPTCHA verification." });
    }
});

// Keep for Render compatibility
module.exports = app;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});








