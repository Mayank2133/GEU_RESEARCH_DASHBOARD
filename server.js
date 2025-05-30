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
const MongoStore = require('connect-mongo');

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

// Middleware

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1);

app.use(session({
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60 // 1 day in seconds
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
        httpOnly: true,
        secure: true,         // ✅ required for SameSite: 'none'
        sameSite: 'none',     // ✅ allows cross-origin session cookies
        maxAge: 86400000,
        
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


app.use(express.static(path.join(__dirname, "public")));


app.use((req, res, next) => {
  console.log("🔍 SESSION DEBUG:", req.session);
  next();
});




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
          remainingJournalGrant: user.remainingJournalGrant,
        };

        // Save session explicitly before sending response
        req.session.save(err => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Session save failed" });
          }
          
          console.log("✅ Session saved after login");
          return res.json({
            success: true,
            message: "Login successful!",
            role: user.role,
          });
        });
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials!" });
      }
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials!" });
    }
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
  console.log("🔍 Checking session on /api/user:", req.session);

  // If session or user is missing, return unauthorized
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const email = req.session.user.email;

    const user = await userModel.getUserByEmail(email);

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
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'geu-profiles',
      resource_type: 'image'
    });
    
    fs.unlinkSync(filePath);
    
    // Use the new findOneAndUpdate method
    const updated = await userModel.findOneAndUpdate(
      { email: req.session.user.email },
      { profilePicture: result.secure_url },
      { new: true }
    );
    
    if (!updated) {
      return res.status(500).json({ success: false, message: "Failed to update user profile" });
    }
    
    res.json({ 
      success: true, 
      profileUrl: result.secure_url
    });
  } catch (err) {
    console.error("Profile upload error:", err);
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


const handleGrantRequest = async (email, grantType, defaultAmount) => {
    try {
        const user = await userModel.getUserByEmail(email);
        if (!user) {
            return { success: false, message: "User not found" };
        }

        const now = new Date();
        const currentYear = now.getFullYear();
        const grantField = `remaining${grantType}Grant`;

        // Reset grant if new year
        if (user.lastGrantYear !== currentYear) {
            const update = {
                [grantField]: defaultAmount,
                lastGrantYear: currentYear
            };

            // Update user in MongoDB
            const updatedUser = await userModel.findOneAndUpdate(
                { email },
                update,
                { new: true }
            );

            return { 
                success: true, 
                remainingGrant: updatedUser[grantField],
                user: updatedUser
            };
        }

        return { 
            success: true, 
            remainingGrant: user[grantField],
            user
        };
    } catch (error) {
        console.error("Grant request error:", error);
        return { 
            success: false, 
            message: "Error processing grant request"
        };
    }
};
// Research grant endpoint
app.get("/api/user-remaining-grant-research", async (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ 
            success: false, 
            message: "Email parameter is required" 
        });
    }

    const result = await handleGrantRequest(email, "Research", 20000);
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

app.post("/Submit-Grant", upload.single('customFile'), async (req, res) => {
    try {
        const { submissionType } = req.body;
        const isResearch = submissionType === "research";
        const prefix = isResearch ? "research_" : "journal_";
        const grantType = isResearch ? "research" : "journal";
        
        // Get user email from session or form
        const email = req.session.user?.email || req.body[`${prefix}email`];
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: "Email is required" 
            });
        }

        // Validate file
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: "PDF file is required" 
            });
        }

        // Get total grant amount
        const tga = parseFloat(req.body[`${prefix}tga`]) || 0;
        
        // Validate charges
        const registrationFee = parseFloat(req.body[`${prefix}rf`]) || 0;
        const travelCharges = parseFloat(req.body[`${prefix}tc`]) || 0;
        const lodgingCharges = parseFloat(req.body[`${prefix}lc`]) || 0;
        const calculatedTotal = registrationFee + travelCharges + lodgingCharges;
        
        if (Math.abs(calculatedTotal - tga) > 0.01) {
            return res.status(400).json({
                success: false,
                message: "Total amount doesn't match sum of individual charges"
            });
        }

        // Find user in MongoDB
        const user = await userModel.getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Handle grant logic
        const now = new Date();
        const currentYear = now.getFullYear();
        const amountRequested = tga;

        // Reset grants if new year
        if (user.lastGrantYear !== currentYear) {
            user.remainingResearchGrant = 20000;
            user.remainingJournalGrant = 30000;
            user.lastGrantYear = currentYear;
        }

        // Check grant balance
        const grantField = isResearch ? "remainingResearchGrant" : "remainingJournalGrant";
        if (user[grantField] < amountRequested) {
            return res.status(400).json({ 
                success: false, 
                message: `Requested amount exceeds your remaining grant of ₹${user[grantField]}`
            });
        }

        // Upload file to Cloudinary
        const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
            resource_type: "auto",
            folder: "geu-submissions",
            format: "pdf"
        });
        
        // Remove local file after upload
        fs.unlinkSync(req.file.path);

        // Calculate remaining balance
        const remainingBalanceAfter = user[grantField] - amountRequested;

        // Prepare submission data for MongoDB
        const submissionData = {
            user: {
                name: req.body[`${prefix}name`],
                email: email,
                phone: req.body[`${prefix}tel`]
            },
            submissionType,
            title: req.body[`${prefix}paper_title`],
            conference: {
                name: req.body[`${prefix}conference_name`],
                date: new Date(req.body[`${prefix}conference_date`]),
                venue: req.body[`${prefix}venue`],
                lastDate: new Date(req.body[`${prefix}last_date`])
            },
            bankDetails: {
                name: req.body[`${prefix}bank_name`],
                accountNumber: req.body[`${prefix}account_number`],
                ifsc: req.body[`${prefix}ifsc`]
            },
            charges: {
                registrationFee,
                travelCharges,
                lodgingCharges,
                totalAmount: tga
            },
            coAuthorCount: parseInt(req.body[`${prefix}coauthor_count`]) || 0,
            receiptUrl: cloudinaryResult.secure_url,
            declaration: req.body[`${prefix}dec`] === "on",
            grantType,
            remainingBalanceAfter
        };

        // Save submission to MongoDB
        const savedSubmission = await submissionModel.createSubmission(submissionData);

        // Update user grants in MongoDB
        const update = {};
        update[grantField] = remainingBalanceAfter;
        update.lastGrantYear = currentYear;
        
        await userModel.findOneAndUpdate(
            { email: email },
            update,
            { new: true }
        );

        return res.status(200).json({ 
            success: true, 
            message: `${isResearch ? "Research" : "Journal"} grant approved. Remaining: ₹${remainingBalanceAfter}`,
            remainingGrant: remainingBalanceAfter,
            submissionId: savedSubmission._id
        });

    } catch (error) {
        console.error("Submission error:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Internal server error during submission",
            error: error.message
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

// Update the route to be async
app.get("/api/user-submissions", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ 
            success: false, 
            message: "Unauthorized" 
        });
    }

    const email = req.session.user.email;
    try {
        // Add await here
        const userSubmissions = await submissionModel.getUserSubmissions(email);
        res.json({ 
            success: true, 
            submissions: userSubmissions 
        });
    } catch (error) {
        console.error("Error fetching submissions:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error" 
        });
    }
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








