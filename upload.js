const path = require('path');
const fs = require('fs');

// Upload directories
const isVercel = !!process.env.VERCEL;
const baseUploadsDir = isVercel ? path.join('/tmp', 'tarcin_uploads') : path.join(__dirname, '..', 'uploads');
const UPLOADS_DIR = baseUploadsDir;
const SUBMISSIONS_DIR = path.join(UPLOADS_DIR, 'submissions');
const BUGS_DIR = path.join(UPLOADS_DIR, 'bugs');
const FILES_DIR = path.join(UPLOADS_DIR, 'files');

// Ensure directories exist
try {
  [UPLOADS_DIR, SUBMISSIONS_DIR, BUGS_DIR, FILES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
} catch (e) {
  console.warn('Upload directory init note:', e.message);
}

let multer;
try {
  multer = require('multer');
} catch (e) {
  multer = null;
}

let uploadZip;
let uploadBugDoc;
let uploadFileZip;

if (multer) {
  const maxMb = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10);
  const maxBytes = maxMb * 1024 * 1024;

  const submissionStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, SUBMISSIONS_DIR),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safeName}`);
    }
  });

  const zipFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.zip') cb(null, true);
    else cb(new Error('Only .ZIP files are allowed!'), false);
  };

  uploadZip = multer({
    storage: submissionStorage,
    limits: { fileSize: maxBytes },
    fileFilter: zipFileFilter
  });

  const fileDashboardStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, FILES_DIR),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safeName}`);
    }
  });

  uploadFileZip = multer({
    storage: fileDashboardStorage,
    limits: { fileSize: maxBytes },
    fileFilter: zipFileFilter
  });

  const bugDocStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, BUGS_DIR),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safeName}`);
    }
  });

  uploadBugDoc = multer({
    storage: bugDocStorage,
    limits: { fileSize: maxBytes }
  });
} else {
  // Pure Node.js fallback multipart parser
  function createPureNodeUploadMiddleware(targetDir, allowedExtensions = null) {
    return {
      single: (fieldName) => async (req, res, next) => {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
          return next();
        }

        const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!match) return next();
        const boundary = match[1] || match[2];

        try {
          const buffers = [];
          for await (const chunk of req) {
            buffers.push(chunk);
          }
          const rawBuffer = Buffer.concat(buffers);
          const parsed = parseMultipartBuffer(rawBuffer, boundary);

          req.body = req.body || {};
          for (const [key, val] of Object.entries(parsed.fields)) {
            req.body[key] = val;
          }

          if (parsed.files[fieldName]) {
            const fileItem = parsed.files[fieldName];
            const ext = path.extname(fileItem.filename).toLowerCase();

            if (allowedExtensions && !allowedExtensions.includes(ext)) {
              return res.status(400).json({
                success: false,
                message: `File format ${ext} not allowed.`
              });
            }

            const safeName = fileItem.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
            const savedName = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safeName}`;
            const targetPath = path.join(targetDir, savedName);

            fs.writeFileSync(targetPath, fileItem.data);

            req.file = {
              fieldname: fieldName,
              originalname: fileItem.filename,
              filename: savedName,
              path: targetPath,
              size: fileItem.data.length
            };
          }

          next();
        } catch (err) {
          next(err);
        }
      }
    };
  }

  function parseMultipartBuffer(buffer, boundary) {
    const boundaryBuffer = Buffer.from('--' + boundary);
    const fields = {};
    const files = {};

    let start = 0;
    while ((start = buffer.indexOf(boundaryBuffer, start)) !== -1) {
      start += boundaryBuffer.length;
      if (buffer.slice(start, start + 2).toString() === '--') break;
      if (buffer.slice(start, start + 2).toString() === '\r\n') start += 2;

      const headerEnd = buffer.indexOf('\r\n\r\n', start);
      if (headerEnd === -1) break;

      const headersText = buffer.slice(start, headerEnd).toString('utf-8');
      start = headerEnd + 4;

      const nextBoundary = buffer.indexOf(boundaryBuffer, start);
      if (nextBoundary === -1) break;

      const content = buffer.slice(start, nextBoundary - 2); // Exclude \r\n before next boundary
      start = nextBoundary;

      const dispMatch = headersText.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
      if (dispMatch) {
        const name = dispMatch[1];
        const filename = dispMatch[2];
        if (filename) {
          files[name] = { filename, data: content };
        } else {
          fields[name] = content.toString('utf-8');
        }
      }
    }

    return { fields, files };
  }

  uploadZip = createPureNodeUploadMiddleware(SUBMISSIONS_DIR, ['.zip']);
  uploadBugDoc = createPureNodeUploadMiddleware(BUGS_DIR, null);
  uploadFileZip = createPureNodeUploadMiddleware(FILES_DIR, ['.zip']);
}

module.exports = {
  uploadZip,
  uploadBugDoc,
  uploadFileZip,
  SUBMISSIONS_DIR,
  BUGS_DIR,
  FILES_DIR
};
