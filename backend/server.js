require('dotenv').config();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const quizRoutes = require('./routes/quizRoutes');
const questionBankRoutes = require('./routes/questionBankRoutes');
const challengeRoutes = require('./routes/challengeRoutes');
const studentRoutes = require('./routes/studentRoutes');
const classRoutes = require('./routes/classRoutes');
const topicRoutes = require('./routes/topicRoutes');
const educatorRoutes = require('./routes/educatorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const cardRoutes = require('./routes/cardRoutes');
const adminCardRoutes = require('./routes/adminCardRoutes');
const contentRoutes = require('./routes/contentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const platformReviewRoutes = require('./routes/platformReviewRoutes');
const platformAdminAuthRoutes = require('./routes/platformAdminAuthRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const shopRoutes = require('./routes/shopRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const parseIdentity = require('./middleware/parseIdentity');
app.use(parseIdentity);

app.use('/api', quizRoutes);
app.use('/api/questionbank', questionBankRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/educators', educatorRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/admin', adminCardRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/platform-reviews', platformReviewRoutes);
app.use('/api/platform-admin', platformAdminAuthRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/shop', shopRoutes);

// Block direct access to uploads; files served only via authenticated/validated API routes
app.use('/backend/uploads', (req, res, next) => {
  res.status(404).send('Not found');
});

// Serve frontend: root shows quiz list, all other paths serve HTML from project folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'educator-quiz.html'));
});
app.use(express.static(path.join(__dirname, '..')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`EduQuest backend running on port ${PORT}`);
});
