const reportModel = require('../models/reportModel');
const studentModel = require('../models/studentModel');
const classModel = require('../models/classModel');
const accessControl = require('../utils/accessControl');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Generate summary_text and recommendations from class report data.
 * @param {Object} reportData - Class report from getClassReportData
 * @returns {{ summary_text: string, recommendations: string[] }}
 */
function generateInsights(reportData) {
  const recommendations = [];
  const parts = [];

  const avg_score = reportData.avg_score != null ? Number(reportData.avg_score) : 0;
  const participation_rate = reportData.participation_rate != null ? Number(reportData.participation_rate) : 0;
  const weakest_topics = reportData.weakest_topics || [];
  const engagement_by_day = reportData.engagement_by_day || [];

  if (avg_score < 65) {
    const topic = weakest_topics.length > 0 ? weakest_topics[0].topic : 'key concepts';
    const msg = 'Class performance is below target. Recommend revisiting weakest topic: ' + topic + '.';
    parts.push(msg);
    recommendations.push('Revisit weakest topic: ' + topic);
  }

  if (participation_rate < 70) {
    parts.push('Engagement is low. Recommend assigning a team challenge.');
    recommendations.push('Assign a team challenge to boost engagement');
  }

  (weakest_topics || []).forEach(function (t) {
    if (t.failure_rate > 40) {
      parts.push('Many students struggle with ' + t.topic + '. Consider a revision quiz.');
      recommendations.push('Create a revision quiz for: ' + t.topic);
    }
  });

  if (engagement_by_day.length >= 2) {
    for (let i = 1; i < engagement_by_day.length; i++) {
      const prev = engagement_by_day[i - 1] || 0;
      const curr = engagement_by_day[i] || 0;
      if (prev > 0 && curr < prev) {
        const d = new Date();
        d.setDate(d.getDate() - (engagement_by_day.length - 1 - i));
        const dayName = DAY_NAMES[d.getDay()];
        parts.push('Engagement drops on ' + dayName + '. Schedule activity or challenge.');
        recommendations.push('Add activity or challenge on ' + dayName);
        break;
      }
    }
  }

  const summary_text = parts.length > 0 ? parts.join(' ') : 'Class metrics are within target. Keep up the good work.';

  return {
    summary_text,
    recommendations: [...new Set(recommendations)]
  };
}

/**
 * GET /api/reports/class/:classId
 * Query: startDate, endDate (optional, ISO date). Identity from headers: x-educatoradmin-id or x-educator-id.
 * EducatorAdmin: class.created_by === educatorAdminId. Educator: canEducatorAccessClass.
 */
async function getClassReport(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const classId = Number(req.params.classId);
    const startDate = req.query.startDate && String(req.query.startDate).trim() ? String(req.query.startDate).trim() : null;
    const endDate = req.query.endDate && String(req.query.endDate).trim() ? String(req.query.endDate).trim() : null;

    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = await reportModel.getClassReportData(classId, startDate, endDate);
    const insights = generateInsights(data);
    res.json({ ...data, insights });
  } catch (err) {
    console.error('Get class report error:', err);
    res.status(500).json({ error: 'Failed to load class report' });
  }
}

/**
 * GET /api/reports/student/:studentId
 * Query: startDate, endDate (optional). Identity from headers: x-educatoradmin-id or x-educator-id.
 * EducatorAdmin: canEducatorAdminAccessStudent. Educator: canEducatorAccessStudent.
 */
async function getStudentReport(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentId = Number(req.params.studentId);
    const startDate = req.query.startDate && String(req.query.startDate).trim() ? String(req.query.startDate).trim() : null;
    const endDate = req.query.endDate && String(req.query.endDate).trim() ? String(req.query.endDate).trim() : null;

    if (isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = await reportModel.getStudentReportData(studentId, startDate, endDate);
    res.json(data);
  } catch (err) {
    console.error('Get student report error:', err);
    res.status(500).json({ error: 'Failed to load student report' });
  }
}

/**
 * GET /api/reports/student/me
 * Student self-report: x-student-id required. Returns only weaknesses, strengths, growth_rate, topic_fail_counts.
 */
async function getStudentReportMe(req, res) {
  try {
    const studentId = Number(req.headers['x-student-id']);
    if (studentId == null || isNaN(studentId)) {
      return res.status(401).json({ error: 'x-student-id header is required' });
    }
    const startDate = req.query.startDate && String(req.query.startDate).trim() ? String(req.query.startDate).trim() : null;
    const endDate = req.query.endDate && String(req.query.endDate).trim() ? String(req.query.endDate).trim() : null;
    const data = await reportModel.getStudentReportData(studentId, startDate, endDate);
    res.json({
      weaknesses: data.weaknesses || [],
      strengths: data.strengths || [],
      growth_rate: data.growth_rate != null ? data.growth_rate : 0,
      topic_fail_counts: data.topic_fail_counts || []
    });
  } catch (err) {
    console.error('Get student report me error:', err);
    res.status(500).json({ error: 'Failed to load report' });
  }
}

/**
 * Generate a PDF file from student report data and save to disk.
 * @returns {Promise<string>} Resolved with file_path (relative to backend root, e.g. uploads/reports/student-1-123.pdf)
 */
function generateStudentReportPDF(studentName, data, filePath) {
  return new Promise(function (resolve, reject) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(20).text('EduQuest Student Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Student: ' + (studentName || 'Student'), { align: 'left' });
    doc.text('Generated: ' + new Date().toLocaleDateString());
    doc.moveDown(1.5);

    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10)
      .text('Total XP: ' + (data.total_xp != null ? data.total_xp : 0))
      .text('Current Streak: ' + (data.current_streak != null ? data.current_streak : 0))
      .text('Quizzes Completed: ' + (data.quizzes_completed != null ? data.quizzes_completed : 0))
      .text('Growth Rate: ' + (data.growth_rate != null ? data.growth_rate : 0) + '%');
    doc.moveDown(1);

    if (data.recent_scores && data.recent_scores.length > 0) {
      doc.fontSize(12).text('Recent Quiz Scores', { underline: true });
      data.recent_scores.slice(0, 10).forEach(function (r) {
        doc.fontSize(10).text((r.quiz_title || 'Quiz') + ': ' + (r.score != null ? r.score : 0) + '%');
      });
      doc.moveDown(1);
    }

    if (data.strengths && data.strengths.length > 0) {
      doc.fontSize(12).text('Strengths', { underline: true });
      doc.fontSize(10).text(data.strengths.join(', '));
      doc.moveDown(1);
    }
    if (data.weaknesses && data.weaknesses.length > 0) {
      doc.fontSize(12).text('Areas to Improve', { underline: true });
      doc.fontSize(10).text(data.weaknesses.join(', '));
      doc.moveDown(1);
    }

    doc.end();
    stream.on('finish', function () { resolve(filePath); });
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

/**
 * Pipe student report PDF to a writable stream (e.g. res). No file saved.
 */
function pipeStudentReportPDF(stream, studentName, data) {
  return new Promise(function (resolve, reject) {
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(stream);
    doc.fontSize(20).text('EduQuest Student Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Student: ' + (studentName || 'Student'), { align: 'left' });
    doc.text('Generated: ' + new Date().toLocaleDateString());
    doc.moveDown(1.5);
    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10)
      .text('Total XP: ' + (data.total_xp != null ? data.total_xp : 0))
      .text('Current Streak: ' + (data.current_streak != null ? data.current_streak : 0))
      .text('Quizzes Completed: ' + (data.quizzes_completed != null ? data.quizzes_completed : 0))
      .text('Growth Rate: ' + (data.growth_rate != null ? data.growth_rate : 0) + '%');
    doc.moveDown(1);
    if (data.recent_scores && data.recent_scores.length > 0) {
      doc.fontSize(12).text('Recent Quiz Scores', { underline: true });
      data.recent_scores.slice(0, 10).forEach(function (r) {
        doc.fontSize(10).text((r.quiz_title || 'Quiz') + ': ' + (r.score != null ? r.score : 0) + '%');
      });
      doc.moveDown(1);
    }
    if (data.strengths && data.strengths.length > 0) {
      doc.fontSize(12).text('Strengths', { underline: true });
      doc.fontSize(10).text(data.strengths.join(', '));
      doc.moveDown(1);
    }
    if (data.weaknesses && data.weaknesses.length > 0) {
      doc.fontSize(12).text('Areas to Improve', { underline: true });
      doc.fontSize(10).text(data.weaknesses.join(', '));
      doc.moveDown(1);
    }
    doc.end();
    doc.on('end', resolve);
    doc.on('error', reject);
    stream.on('error', reject);
  });
}

/**
 * Pipe class report PDF to a writable stream (e.g. res). No file saved.
 */
function pipeClassReportPDF(stream, className, data) {
  return new Promise(function (resolve, reject) {
    const insights = generateInsights(data);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(stream);
    doc.fontSize(20).text('EduQuest Class Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('Class: ' + (className || 'Class'), { align: 'left' });
    doc.text('Generated: ' + new Date().toLocaleDateString());
    doc.moveDown(1.5);
    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10)
      .text('Average Score: ' + (data.avg_score != null ? data.avg_score : 0) + '%')
      .text('Participation Rate: ' + (data.participation_rate != null ? data.participation_rate : 0) + '%')
      .text('Total Challenges Completed: ' + (data.total_challenges_completed != null ? data.total_challenges_completed : 0))
      .text('Total XP: ' + (data.total_xp != null ? data.total_xp : 0));
    doc.moveDown(1);
    if (data.top_performers && data.top_performers.length > 0) {
      doc.fontSize(12).text('Top Performers', { underline: true });
      data.top_performers.slice(0, 5).forEach(function (p) {
        doc.fontSize(10).text((p.name || '—') + ': ' + (p.avg_score != null ? p.avg_score : 0) + '%');
      });
      doc.moveDown(1);
    }
    if (data.engagement_by_day && data.engagement_by_day.length > 0) {
      doc.fontSize(12).text('Engagement by Day (last 7)', { underline: true });
      doc.fontSize(10).text(data.engagement_by_day.join(', '));
      doc.moveDown(1);
    }
    doc.fontSize(12).text('Insight', { underline: true });
    doc.fontSize(10).text(insights.summary_text || 'No insights yet.');
    doc.end();
    doc.on('end', resolve);
    doc.on('error', reject);
    stream.on('error', reject);
  });
}

/**
 * POST /api/reports/generate-pdf
 * Body: { type: 'student'|'class', id: studentId|classId, startDate, endDate }.
 * Educator or EducatorAdmin. Returns application/pdf blob.
 */
async function generatePdf(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const body = req.body || {};
    const type = body.type === 'class' ? 'class' : (body.type === 'student' ? 'student' : null);
    const id = body.id != null ? Number(body.id) : NaN;
    const startDate = (body.startDate && String(body.startDate).trim()) || null;
    const endDate = (body.endDate && String(body.endDate).trim()) || null;

    if (!type || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid body: type (student|class) and id required' });
    }
    if (!isNaN(educatorAdminId)) {
      if (type === 'class') {
        const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, id);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else {
        const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, id);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (!isNaN(educatorId)) {
      if (type === 'class') {
        const ok = await accessControl.canEducatorAccessClass(educatorId, id);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else {
        const ok = await accessControl.canEducatorAccessStudent(educatorId, id);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const filename = 'EduQuest-Report-' + new Date().toISOString().slice(0, 10) + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');

    if (type === 'student') {
      const data = await reportModel.getStudentReportData(id, startDate, endDate);
      const student = await studentModel.findStudentById(id);
      const studentName = (student && student.name) ? student.name : 'Student';
      await pipeStudentReportPDF(res, studentName, data);
    } else {
      const data = await reportModel.getClassReportData(id, startDate, endDate);
      const cls = await classModel.getClassById(id);
      const className = (cls && cls.name) ? cls.name : 'Class ' + id;
      await pipeClassReportPDF(res, className, data);
    }
  } catch (err) {
    console.error('Generate PDF error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
  }
}

/**
 * Escape a CSV cell (quote if contains comma, quote, or newline).
 */
function escapeCsvCell(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * Build CSV rows for class or student report (same structure as former frontend).
 */
function reportToCsvRows(data, type, meta) {
  const rows = [];
  if (type === 'class') {
    rows.push(['Report Type', 'Class Report']);
    rows.push(['Class', meta.className || '']);
    rows.push(['Average Score (%)', data.avg_score != null ? data.avg_score : '']);
    rows.push(['Participation Rate (%)', data.participation_rate != null ? data.participation_rate : '']);
    rows.push(['Total Challenges Completed', data.total_challenges_completed != null ? data.total_challenges_completed : '']);
    rows.push(['Total XP', data.total_xp != null ? data.total_xp : '']);
    rows.push([]);
    rows.push(['Top Performers', 'Average Score (%)']);
    (data.top_performers || []).forEach(function (p) {
      rows.push([p.name || '', p.avg_score != null ? p.avg_score : '']);
    });
    rows.push([]);
    const days = (data.engagement_by_day || []);
    rows.push(['Engagement by Day'].concat(days));
    rows.push([]);
    const insights = data.insights || {};
    rows.push(['Insight', insights.summary_text ? insights.summary_text : '']);
  } else {
    rows.push(['Report Type', 'Student Report']);
    rows.push(['Student', meta.studentName || '']);
    rows.push(['Total XP', data.total_xp != null ? data.total_xp : '']);
    rows.push(['Current Streak', data.current_streak != null ? data.current_streak : '']);
    rows.push(['Quizzes Completed', data.quizzes_completed != null ? data.quizzes_completed : '']);
    rows.push(['Growth Rate (%)', data.growth_rate != null ? data.growth_rate : '']);
    rows.push([]);
    rows.push(['Recent Quiz', 'Score (%)']);
    (data.recent_scores || []).forEach(function (r) {
      rows.push([r.quiz_title || 'Quiz', r.score != null ? r.score : '']);
    });
    rows.push([]);
    rows.push(['Strengths'].concat(data.strengths || []));
    rows.push(['Weaknesses'].concat(data.weaknesses || []));
    rows.push([]);
    const recs = [];
    (data.topic_fail_counts || []).forEach(function (x) {
      if (x.fail_count > 3) recs.push('Assign targeted quiz on ' + (x.topic_name || 'topic'));
    });
    if (data.engagement_trend === 'declining' || data.streak_dropped) recs.push('Engagement declining — suggest weekly challenge');
    if (recs.length) rows.push(['Recommended Practice'].concat(recs));
    rows.push(['Progress Trend', data.engagement_trend || 'stable']);
  }
  return rows;
}

/**
 * GET /api/reports/export-csv
 * Query: type=student|class, id=studentId|classId, startDate, endDate.
 * Educator or EducatorAdmin. Returns text/csv with Content-Disposition attachment.
 */
async function exportCsv(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const type = req.query.type === 'class' ? 'class' : (req.query.type === 'student' ? 'student' : null);
    const id = req.query.id != null ? Number(req.query.id) : NaN;
    const startDate = (req.query.startDate && String(req.query.startDate).trim()) || null;
    const endDate = (req.query.endDate && String(req.query.endDate).trim()) || null;

    if (!type || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid query: type (student|class) and id required' });
    }
    if (!isNaN(educatorAdminId)) {
      if (type === 'class') {
        const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, id);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else {
        const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, id);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      }
    } else if (!isNaN(educatorId)) {
      if (type === 'class') {
        const ok = await accessControl.canEducatorAccessClass(educatorId, id);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else {
        const ok = await accessControl.canEducatorAccessStudent(educatorId, id);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let data;
    const meta = { className: null, studentName: null };
    if (type === 'class') {
      data = await reportModel.getClassReportData(id, startDate, endDate);
      const insights = generateInsights(data);
      data = { ...data, insights };
      const cls = await classModel.getClassById(id);
      meta.className = (cls && cls.name) ? cls.name : 'Class ' + id;
    } else {
      data = await reportModel.getStudentReportData(id, startDate, endDate);
      const student = await studentModel.findStudentById(id);
      meta.studentName = (student && student.name) ? student.name : 'Student ' + id;
    }

    const rows = reportToCsvRows(data, type, meta);
    const csv = rows.map(function (row) {
      return row.map(escapeCsvCell).join(',');
    }).join('\r\n');
    const filename = 'EduQuest-Report-' + new Date().toISOString().slice(0, 10) + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
}

/**
 * POST /api/reports/student/:studentId/send
 * Educator sends student report to EduQuest Inbox. Generates PDF, stores file, inserts student_reports.
 * Requires x-educator-id (educator only). Body: { classId } (optional).
 */
async function sendStudentReport(req, res) {
  try {
    const educatorId = Number(req.headers['x-educator-id']);
    const studentId = Number(req.params.studentId);
    const classId = req.body && req.body.classId != null ? Number(req.body.classId) : null;

    if (isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    if (isNaN(educatorId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const ok = await accessControl.canEducatorAccessStudent(educatorId, studentId);
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    const startDate = (req.body && req.body.startDate) || (req.query && req.query.startDate) || null;
    const endDate = (req.body && req.body.endDate) || (req.query && req.query.endDate) || null;
    const data = await reportModel.getStudentReportData(studentId, startDate, endDate);
    const student = await studentModel.findStudentById(studentId);
    const studentName = student && student.name ? student.name : 'Student';

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'reports');
    const timestamp = Date.now();
    const filename = 'student-' + studentId + '-' + timestamp + '.pdf';
    const filePath = path.join(uploadsDir, filename);

    await generateStudentReportPDF(studentName, data, filePath);

    const relativePath = path.join('uploads', 'reports', filename);
    const row = await reportModel.createStudentReport(studentId, educatorId, classId, 'student', relativePath);

    res.status(201).json({ success: true, message: 'Report sent to student inbox.', reportId: row && row.id });
  } catch (err) {
    console.error('Send student report error:', err);
    res.status(500).json({ error: 'Failed to send report' });
  }
}

/**
 * GET /api/reports/file/:reportId
 * Stream report PDF. Student: must be report.student_id. Educator: must be report.educator_id.
 */
async function getReportFile(req, res) {
  try {
    const reportId = Number(req.params.reportId);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const educatorIdHeader = Number(req.headers['x-educator-id']);

    if (isNaN(reportId)) {
      return res.status(400).json({ error: 'Invalid report id' });
    }

    const report = await reportModel.getReportById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const isStudent = !isNaN(studentIdHeader) && studentIdHeader === report.student_id;
    const isEducator = !isNaN(educatorIdHeader) && educatorIdHeader === report.educator_id;

    if (!isStudent && !isEducator) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const absolutePath = path.join(__dirname, '..', report.file_path);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filename = path.basename(report.file_path);
    res.download(absolutePath, filename);
  } catch (err) {
    console.error('Get report file error:', err);
    res.status(500).json({ error: 'Failed to download report' });
  }
}

/**
 * DELETE /api/reports/student-report/:reportId
 * Student only. Deletes a report from the student's inbox if report.student_id matches x-student-id.
 */
async function deleteStudentReport(req, res) {
  try {
    const reportId = Number(req.params.reportId);
    const studentId = Number(req.headers['x-student-id']);

    if (isNaN(reportId)) {
      return res.status(400).json({ error: 'Invalid report id' });
    }
    if (!studentId || isNaN(studentId)) {
      return res.status(401).json({ error: 'Student identity required' });
    }

    const report = await reportModel.getReportById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (Number(report.student_id) !== studentId) {
      return res.status(403).json({ error: 'You can only delete your own reports' });
    }

    await reportModel.deleteReportById(reportId);
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    console.error('Delete student report error:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
}

module.exports = { getClassReport, getStudentReport, getStudentReportMe, sendStudentReport, getReportFile, generatePdf, exportCsv, deleteStudentReport };
