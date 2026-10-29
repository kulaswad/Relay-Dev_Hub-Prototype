import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

async function generateSampleKycDocs() {
  const outputDir = path.resolve(process.cwd(), "public", "sample-docs");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Doc 1: Form GST REG-06 (Government of India Registration Certificate)
  // -------------------------------------------------------------------------
  const doc1 = await PDFDocument.create();
  const fontBold = await doc1.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc1.embedFont(StandardFonts.Helvetica);

  const page1 = doc1.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Draw header border & banner
  page1.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: rgb(0.15, 0.15, 0.2),
    borderWidth: 1.5,
  });

  page1.drawText("GOVERNMENT OF INDIA", {
    x: width / 2 - 90,
    y: height - 70,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.3),
  });

  page1.drawText("FORM GST REG-06", {
    x: width / 2 - 60,
    y: height - 90,
    size: 11,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  page1.drawText("[See Rule 10(1)]", {
    x: width / 2 - 35,
    y: height - 105,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  page1.drawText("REGISTRATION CERTIFICATE", {
    x: width / 2 - 85,
    y: height - 125,
    size: 13,
    font: fontBold,
    color: rgb(0.15, 0.45, 0.25),
  });

  // Table rows
  const startY = height - 170;
  const fields = [
    ["1. Registration Number (GSTIN)", "27AABCM8822K1Z9"],
    ["2. Legal Name", "MERIDIAN FINANCIAL SERVICES PRIVATE LIMITED"],
    ["3. Trade Name", "Meridian Finserv"],
    ["4. Constitution of Business", "Private Limited Company"],
    ["5. Address of Principal Place of Business", "Plot C-24, G-Block, Bandra Kurla Complex, Mumbai, MH - 400051"],
    ["6. Date of Liability", "01/04/2022"],
    ["7. Period of Validity", "From: 01/04/2022  To: Regular"],
    ["8. Type of Registration", "Regular Taxpayer"],
    ["9. Particulars of Approving Authority", "Centre: Mumbai Central Division-II"],
  ];

  fields.forEach(([label, value], i) => {
    const y = startY - i * 36;
    page1.drawText(label, {
      x: 55,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.25),
    });
    page1.drawText(value, {
      x: 55,
      y: y - 14,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.1, 0.1, 0.1),
    });
    page1.drawLine({
      start: { x: 55, y: y - 20 },
      end: { x: width - 55, y: y - 20 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
  });

  // Official Stamp & Verification Watermark
  page1.drawRectangle({
    x: width - 200,
    y: 80,
    width: 140,
    height: 60,
    borderColor: rgb(0.2, 0.4, 0.7),
    borderWidth: 1,
  });
  page1.drawText("DIGITALLY SIGNED", {
    x: width - 185,
    y: 122,
    size: 8.5,
    font: fontBold,
    color: rgb(0.2, 0.4, 0.7),
  });
  page1.drawText("Assistant Commissioner", {
    x: width - 185,
    y: 108,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });
  page1.drawText("State Tax Dept, Maharashtra", {
    x: width - 185,
    y: 95,
    size: 7,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  });

  fs.writeFileSync(
    path.join(outputDir, "gst_certificate_meridian.pdf"),
    await doc1.save()
  );

  // -------------------------------------------------------------------------
  // Doc 2: PAN Card (Income Tax Department, Government of India)
  // -------------------------------------------------------------------------
  const doc2 = await PDFDocument.create();
  const p2FontBold = await doc2.embedFont(StandardFonts.HelveticaBold);
  const p2FontReg = await doc2.embedFont(StandardFonts.Helvetica);
  const page2 = doc2.addPage([450, 280]); // Card dimensions

  // Card background & header
  page2.drawRectangle({
    x: 10,
    y: 10,
    width: 430,
    height: 260,
    borderColor: rgb(0.2, 0.35, 0.6),
    borderWidth: 1.5,
    color: rgb(0.96, 0.98, 1.0),
  });

  page2.drawText("INCOME TAX DEPARTMENT", {
    x: 120,
    y: 242,
    size: 13,
    font: p2FontBold,
    color: rgb(0.1, 0.25, 0.5),
  });

  page2.drawText("GOVT. OF INDIA", {
    x: 165,
    y: 226,
    size: 9.5,
    font: p2FontBold,
    color: rgb(0.3, 0.3, 0.3),
  });

  page2.drawText("Permanent Account Number Card", {
    x: 125,
    y: 200,
    size: 10,
    font: p2FontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  page2.drawText("AABCM8822K", {
    x: 135,
    y: 172,
    size: 18,
    font: p2FontBold,
    color: rgb(0.05, 0.1, 0.2),
  });

  page2.drawText("Name:", { x: 30, y: 130, size: 8, font: p2FontBold, color: rgb(0.4, 0.4, 0.4) });
  page2.drawText("MERIDIAN FINANCIAL SERVICES PRIVATE LIMITED", {
    x: 30,
    y: 115,
    size: 10,
    font: p2FontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page2.drawText("Date of Incorporation:", { x: 30, y: 85, size: 8, font: p2FontBold, color: rgb(0.4, 0.4, 0.4) });
  page2.drawText("14/05/2018", { x: 30, y: 70, size: 10, font: p2FontBold, color: rgb(0.1, 0.1, 0.1) });

  page2.drawText("Category:", { x: 260, y: 85, size: 8, font: p2FontBold, color: rgb(0.4, 0.4, 0.4) });
  page2.drawText("Company", { x: 260, y: 70, size: 10, font: p2FontBold, color: rgb(0.1, 0.1, 0.1) });

  fs.writeFileSync(
    path.join(outputDir, "pan_card_meridian.pdf"),
    await doc2.save()
  );

  // -------------------------------------------------------------------------
  // Doc 3: Certificate of Incorporation (Deliberate legal name mismatch!)
  // Fictional company: "Zenith Express Logistics" declared, but doc has "ZENITH LOGISTICS CLOUD INDIA PRIVATE LIMITED"
  // -------------------------------------------------------------------------
  const doc3 = await PDFDocument.create();
  const p3FontBold = await doc3.embedFont(StandardFonts.HelveticaBold);
  const p3FontReg = await doc3.embedFont(StandardFonts.Helvetica);
  const page3 = doc3.addPage([595.28, 841.89]);
  const p3W = page3.getSize().width;
  const p3H = page3.getSize().height;

  page3.drawRectangle({
    x: 30,
    y: 30,
    width: p3W - 60,
    height: p3H - 60,
    borderColor: rgb(0.6, 0.45, 0.2),
    borderWidth: 2,
  });

  page3.drawText("GOVERNMENT OF INDIA", {
    x: p3W / 2 - 90,
    y: p3H - 75,
    size: 14,
    font: p3FontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page3.drawText("MINISTRY OF CORPORATE AFFAIRS", {
    x: p3W / 2 - 120,
    y: p3H - 95,
    size: 12,
    font: p3FontBold,
    color: rgb(0.3, 0.25, 0.1),
  });

  page3.drawText("Registrar of Companies, Karnataka", {
    x: p3W / 2 - 95,
    y: p3H - 115,
    size: 10,
    font: p3FontReg,
    color: rgb(0.4, 0.4, 0.4),
  });

  page3.drawText("CERTIFICATE OF INCORPORATION", {
    x: p3W / 2 - 110,
    y: p3H - 160,
    size: 13,
    font: p3FontBold,
    color: rgb(0.5, 0.2, 0.1),
  });

  page3.drawText("[Pursuant to sub-section (2) of section 7 and sub-section (1) of section 8 of the Companies Act, 2013]", {
    x: 75,
    y: p3H - 180,
    size: 8,
    font: p3FontReg,
    color: rgb(0.45, 0.45, 0.45),
  });

  const p3Body = [
    "I hereby certify that",
    "ZENITH LOGISTICS CLOUD INDIA PRIVATE LIMITED", // <-- MISMATCH with "Zenith Express Logistics Ltd"
    "is incorporated on this Nineteenth day of August Two thousand twenty-one under the Companies Act, 2013",
    "and that the company is Company limited by shares.",
    "",
    "The Corporate Identity Number (CIN) of the company is:",
    "U72900KA2021PTC148892",
    "",
    "Permanent Account Number (PAN) of the company is:",
    "AAFCZ4491J",
  ];

  let p3Y = p3H - 240;
  p3Body.forEach((line) => {
    const isHighlight = line === "ZENITH LOGISTICS CLOUD INDIA PRIVATE LIMITED" || line === "U72900KA2021PTC148892";
    page3.drawText(line, {
      x: isHighlight ? 80 : 65,
      y: p3Y,
      size: isHighlight ? 12 : 9.5,
      font: isHighlight ? p3FontBold : p3FontReg,
      color: isHighlight ? rgb(0.1, 0.15, 0.35) : rgb(0.2, 0.2, 0.2),
    });
    p3Y -= isHighlight ? 26 : 20;
  });

  fs.writeFileSync(
    path.join(outputDir, "incorporation_certificate_zenith.pdf"),
    await doc3.save()
  );

  console.log("✅ Successfully generated 3 realistic KYC sample PDFs in public/sample-docs:");
  console.log("   - gst_certificate_meridian.pdf");
  console.log("   - pan_card_meridian.pdf");
  console.log("   - incorporation_certificate_zenith.pdf (contains deliberate legal name mismatch)");
}

generateSampleKycDocs().catch(console.error);
