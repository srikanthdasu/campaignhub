const db = require("../db/db");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// ===============================
// Scheduler PDF Report
// ===============================
exports.schedulerPdf = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT platform, caption, schedule_time, status
            FROM scheduled_posts
            ORDER BY schedule_time ASC
        `);

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=CampaignHub_Scheduler.pdf"
        );

        doc.pipe(res);

        doc.fontSize(22).text("CampaignHub AI - Scheduled Posts", {
            align: "center"
        });

        doc.moveDown();

        result.rows.forEach((row, index) => {
            doc.fontSize(14).text(`Post ${index + 1}`, {
                underline: true
            });

            doc.text(`Platform: ${row.platform}`);
            doc.text(`Caption: ${row.caption}`);
            doc.text(
                `Schedule Time: ${new Date(row.schedule_time).toLocaleString()}`
            );
            doc.text(`Status: ${row.status}`);

            doc.moveDown();
        });

        doc.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Scheduler Excel Report
// ===============================
exports.schedulerExcel = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT platform, caption, schedule_time, status
            FROM scheduled_posts
            ORDER BY schedule_time ASC
        `);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Scheduled Posts");

        sheet.columns = [
            { header: "Platform", key: "platform", width: 20 },
            { header: "Caption", key: "caption", width: 60 },
            { header: "Schedule Time", key: "schedule_time", width: 25 },
            { header: "Status", key: "status", width: 15 }
        ];

        result.rows.forEach(row => sheet.addRow(row));

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=CampaignHub_Scheduler.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Caption PDF Report
// ===============================
exports.captionsPdf = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT prompt, platform, caption, created_at
            FROM captions
            ORDER BY created_at DESC
        `);

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=CampaignHub_Captions.pdf"
        );

        doc.pipe(res);

        doc.fontSize(20).text("CampaignHub AI - Caption Report", {
            align: "center"
        });

        doc.moveDown();

        result.rows.forEach((row, index) => {
            doc.fontSize(14).text(`Caption ${index + 1}`, {
                underline: true
            });

            doc.text(`Prompt: ${row.prompt}`);
            doc.text(`Platform: ${row.platform}`);
            doc.text(`Caption: ${row.caption}`);
            doc.text(`Created: ${new Date(row.created_at).toLocaleString()}`);

            doc.moveDown();
        });

        doc.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// ===============================
// Caption Excel Report
// ===============================
exports.captionsExcel = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT prompt, platform, caption, created_at
            FROM captions
            ORDER BY created_at DESC
        `);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Captions");

        sheet.columns = [
            { header: "Prompt", key: "prompt", width: 30 },
            { header: "Platform", key: "platform", width: 20 },
            { header: "Caption", key: "caption", width: 60 },
            { header: "Created At", key: "created_at", width: 25 }
        ];

        result.rows.forEach(row => sheet.addRow(row));

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=CampaignHub_Captions.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};