const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabase.config');
const upload = multer({ storage: multer.memoryStorage() });
const File = require('../models/files.model');
const { protect, requireAuth } = require('../middleware/auth');
const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const PDFParse = require('pdf-parse');
const fetch = require('node-fetch');

// --- EXISTING ROUTES (no changes here) ---

router.get("/", protect, async (req, res) => { // Changed from "/home" to "/"
    let files = [];
    if (req.user) {
        try {
            files = await File.find({ uploadedBy: req.user._id }).sort({ uploadedAt: -1 });
        } catch (error) {
            console.error('Error fetching user files:', error);
        }
    }
    // Render the home page (home.ejs)
    res.render('home', { files: files, user: req.user });
});

router.post('/upload', requireAuth, upload.single('policy'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const bucketName = 'drive';
        const file = req.file;
        const filePath = `${Date.now()}_${file.originalname}`;

        const { error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
            });

        if (error) {
            console.error('Supabase upload error:', error);
            return res.status(500).send('Upload failed.');
        }

        const fileUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;

        const newFile = new File({
            fileName: file.originalname,
            fileUrl: fileUrl,
            uploadedBy: req.user._id
        });
        await newFile.save();

        console.log('File uploaded to Supabase and metadata saved successfully.');
        res.redirect('/');
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).send('Something went wrong.');
    }
});

// --- NEW ROUTE for Policy Check with Augmented Prompt ---

router.post('/check-policy/:fileId', requireAuth, async (req, res) => {
    try {
        const fileId = req.params.fileId;
        const policyQuestion = req.body.policyQuestion;

        if (!policyQuestion) {
            return res.status(400).send('Policy question is required.');
        }

        const fileDoc = await File.findById(fileId);
        if (!fileDoc || fileDoc.uploadedBy.toString() !== req.user._id.toString()) {
            return res.status(404).send('File not found or not authorized to access.');
        }

        const pdfUrl = fileDoc.fileUrl;
        const pdfResponse = await fetch(pdfUrl);
        if (!pdfResponse.ok) {
            console.error('Failed to download PDF from Supabase:', pdfResponse.statusText);
            return res.status(500).send('Failed to retrieve PDF for processing.');
        }
        const pdfBuffer = await pdfResponse.buffer();
        const data = await PDFParse(pdfBuffer);
        const pdfText = data.text;

// --- SPECIFIC PDF QUERY SOLVER AGENT PROMPT ---
const prompt = `You are an intelligent document query-solving agent. 
Your job is to read the provided PDF text and accurately answer the user's question based ONLY on that text. 
You can handle:
- Insurance and policy-related questions (eligibility, coverage, waiting periods, exclusions)
- Legal/contract queries (clauses, obligations, rights, penalties)
- Instructional/manual queries (steps, procedures, troubleshooting)
- General factual lookups from the document

Do NOT guess or use outside information. If the document does not contain enough details, clearly state that.

Document Text:
"""
${pdfText}
"""

User's Query: "${policyQuestion}"

Respond with:
1. **Answer:** A clear, specific response to the query.  
   * If the query is a yes/no type (e.g., eligibility), respond with 'Yes', 'No', or 'Cannot Determine'.  
   * If it’s informational, summarize the relevant details directly from the document.  
2. **Reasoning:** Explain how you arrived at your answer, citing the exact lines, clauses, or sections from the document.  
3. **Key Extracts:** Quote the most relevant text that supports your answer.

Keep your tone precise, professional, and easy to understand. 
Never include information not explicitly stated in the document.`;
// --- END SPECIFIC PDF QUERY SOLVER AGENT PROMPT ---
        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        };

        const apiKey = process.env.GEMINI_API_KEY || "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        let apiResult;
        for (let i = 0; i < 3; i++) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorBody = await response.json();
                    console.error(`Gemini API error (attempt ${i + 1}):`, response.status, errorBody);
                    if (response.status === 429 && i < 2) {
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                        continue;
                    }
                    throw new Error(`Gemini API request failed with status ${response.status}`);
                }
                apiResult = await response.json();
                break;
            } catch (apiErr) {
                console.error(`Error during Gemini API fetch (attempt ${i + 1}):`, apiErr.message);
                if (i === 2) throw apiErr;
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
        
        if (!apiResult || !apiResult.candidates || apiResult.candidates.length === 0 || !apiResult.candidates[0].content || !apiResult.candidates[0].content.parts || apiResult.candidates[0].content.parts.length === 0) {
            throw new Error('Invalid response structure from Gemini API.');
        }

        const llmResponse = apiResult.candidates[0].content.parts[0].text;

        res.json({ success: true, policyResult: llmResponse });

    } catch (err) {
        console.error('Error checking policy:', err);
        res.status(500).send('Failed to check policy.');
    }
});

module.exports = router;