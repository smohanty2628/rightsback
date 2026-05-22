# Rights Back Calculator

A full-stack web application for analyzing copyright termination and music rights calculations for Herb Jordan at The Adage Group.

## 🎯 Overview

The Rights Back Calculator helps analyze copyright termination dates and music rights ownership for songs from the 1960s era, integrating data from multiple sources including Pitchfork, Wikipedia, ASCAP, and BMI.

## 🚀 Features

- **Multi-step Form Wizard**: User-friendly interface for data input with validation
- **Copyright Termination Analysis**: Calculate termination dates based on copyright law using AI
- **Music Rights Database**: Integration with ASCAP and BMI data
- **Admin Dashboard**: View, manage, and export submission data
- **Email Notifications**: Automated email alerts for new submissions
- **Data Storage**: SQLite database for persistent storage
- **Terms of Service & Privacy Policy**: Built-in legal compliance
- **Responsive Design**: Works on desktop and mobile devices

## 🛠️ Technology Stack

### Frontend
- HTML5, CSS3
- Vanilla JavaScript
- Multi-step form with client-side validation

### Backend
- Node.js + Express.js
- SQLite database
- Nodemailer (email notifications)
- Anthropic Claude API (AI-powered analysis)
- CORS enabled

### Dependencies
- `express` - Web server framework
- `dotenv` - Environment variable management
- `cors` - Cross-origin resource sharing
- `nodemailer` - Email sending
- `@anthropic-ai/sdk` - Claude AI integration
- `axios` - HTTP client

## 📋 Project Structure

```
rightsback/
├── public/                  # Frontend files
│   ├── index.html          # Main application form
│   ├── admin.html          # Admin dashboard
│   ├── results.html        # Results display
│   ├── success.html        # Success page
│   ├── terms-of-use.html   # Terms of service
│   ├── privacy-policy.html # Privacy policy
│   ├── css/                # Stylesheets
│   │   └── error-display.css
│   └── js/                 # Client-side JavaScript
│       ├── FormSubmission.js
│       └── ErrorDisplay.js
├── server.js               # Main Express server
├── storage.js              # Database operations
├── database-search.js      # Database search utilities
├── email.js                # Email sending logic
├── analysis.js             # AI analysis logic
├── lookup.js               # Data lookup utilities
├── rightsback.db           # SQLite database (not in git)
├── submissions.csv         # Export file (not in git)
├── package.json            # Node.js dependencies
├── .env                    # Environment variables (not in git)
├── .env.example            # Example env file (safe to commit)
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## 🔧 Local Development

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Gmail account for email functionality
- Anthropic API key

### Setup Instructions

1. **Clone the repository:**
```bash
git clone https://github.com/smohanty2628/rightsback.git
cd rightsback
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your credentials:
# - Gmail credentials (App Password)
# - Admin username/password
# - Anthropic API key
```

4. **Start the development server:**
```bash
npm run dev
# Or for production:
npm start
```

5. **Access the application:**
```
Frontend: http://localhost:3000
Admin: http://localhost:3000/admin.html
```

## 📝 Usage

### For End Users:
1. Visit the application URL
2. Read and accept the Terms of Service
3. Fill out the multi-step form with song information
4. Submit for copyright termination analysis
5. Review the AI-generated results

### For Administrators:
1. Navigate to `/admin.html`
2. Log in with admin credentials
3. View all submissions
4. Export data as CSV
5. Search and filter records
6. Delete outdated entries

## 🔒 Security Notes

**IMPORTANT:** Never commit these files to Git:
- `.env` - Contains sensitive credentials
- `rightsback.db` - Contains user data
- `*.csv` - Contains submission data
- `analysis_records/` - Contains analysis results
- `deleted_records/` - Contains deleted submissions

The `.gitignore` file is configured to protect these automatically.

## 📦 Deployment

### Vercel Deployment (Recommended)
1. Push code to GitHub (without sensitive files)
2. Connect GitHub repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Manual Deployment
```bash
# On your server:
git pull origin main
npm install
npm start
```

## 🔑 Environment Variables

See `.env.example` for all required variables:
- `PORT` - Server port (default: 3000)
- `GMAIL_USER` - Gmail address for sending emails
- `GMAIL_APP_PASSWORD` - Gmail app password
- `NOTIFY_EMAIL` - Email for receiving notifications
- `ADMIN_USER` - Admin dashboard username
- `ADMIN_PASS` - Admin dashboard password
- `ANTHROPIC_API_KEY` - Claude API key for analysis

## 👤 Developer

**Subham Mohanty**
- Analytics Engineer 1 at Blue Cross Blue Shield of Michigan
- M.S. in AI & Business Analytics, University of South Florida
- GitHub: [@smohanty2628](https://github.com/smohanty2628)
- Developed for: The Adage Group

## 📄 License

This project was developed for The Adage Group and Herb Jordan.

## 🤝 Contributing

This is a private project for a specific client. For inquiries, please contact the developer.

## 📧 Contact

For questions or support, please reach out through GitHub or email.

---

**Last Updated**: May 2026