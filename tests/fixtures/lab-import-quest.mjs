// De-identified reconstruction of the supplied report. No patient PDF or identifiers.
// Retains different font baselines, headers, assay paragraphs and a blank page.
// The seven analyte rows below are the explicit golden acceptance values.
const text = (text, x, y, height = 7.8) => ({ text, x, y, height, width: text.length * height * 0.45 })
const row = (name, value, range, y) => [text(name, 57, y), text(value, 331, y), text(`Reference Range: ${range}`, 364, y + 1.2, 6.6)]
export const expectedQuest = [
  ['TESTOSTERONE, TOTAL, MS', '1077', 'ng/dL', '250', '1100', ''],
  ['SEX HORMONE BINDING GLOBULIN', '24', 'nmol/L', '10', '50', ''],
  ['ALBUMIN', '4.2', 'g/dL', '3.6', '5.1', ''],
  ['TESTOSTERONE, FREE', '235.8', 'pg/mL', '46.0', '224.0', 'high'],
  ['TESTOSTERONE,BIOAVAILABLE', '454.2', 'ng/dL', '110.0', '575.0', ''],
  ['IGF 1, LC/MS', '204', 'ng/mL', '53', '331', ''],
  ['Z SCORE (MALE)', '0.8', 'SD', '-2.0', '+2.0', ''],
]
export const questPages = [
  [
    text('EXAMPLE,PATIENT', 54, 720, 12),
    text('DOB: 01/01/1980  Specimen: SYNTHETIC123  Collected: 08/14/2025 11:21', 54, 690, 6),
    text('Requisition: SYNTHETIC456  Reported: 08/16/2025 23:29  Report Status: FINAL', 54, 680, 6),
    text('Phone: (212) 555-0100', 54, 670, 6), text('EXAMPLE CITY, CA 90000', 54, 660, 6),
    text('FASTING:YES', 54, 640), text('TESTOSTERONE, FREE, BIOAVAILABLE AND TOTAL, MS', 54, 610, 9.6),
    text('Analyte', 57, 590), text('Value', 331, 590),
    ...row('TESTOSTERONE, TOTAL, MS', '1077', '250-1100 ng/dL', 573),
    text('For additional information, please refer to', 57, 558),
    text('http://example.test/assays/2022', 57, 549),
    text('This test was developed and its analytical performance', 57, 537),
    text('characteristics have been determined by Quest Diagnostics.', 57, 528),
    text('It has not been cleared or approved by the FDA.', 57, 519),
    text('This assay is used for clinical purposes under CLIA regulations.', 57, 510),
    ...row('SEX HORMONE BINDING GLOBULIN', '24', '10-50 nmol/L', 452),
    ...row('ALBUMIN', '4.2', '3.6-5.1 g/dL', 435),
    text('TESTOSTERONE, FREE AND BIOAVAILABLE', 57, 420, 9.6),
    text('Analyte', 57, 401), text('Value', 331, 401),
    ...row('TESTOSTERONE, FREE', '235.8 H', '46.0-224.0 pg/mL', 384),
    ...row('TESTOSTERONE,BIOAVAILABLE', '454.2', '110.0-575.0 ng/dL', 367),
    text('IGF 1, LC/MS', 54, 337, 9.6), text('Analyte', 57, 318), text('Value', 331, 318),
    ...row('IGF 1, LC/MS', '204', '53-331 ng/mL', 301),
    ...row('Z SCORE (MALE)', '0.8', '-2.0 - +2.0 SD', 284),
    text('This assay has been validated and is used for clinical purposes.', 57, 260),
    text('Performing Sites', 54, 230),
    text('ZZ Quest Diagnostics, 10101 Newbrook Dr, Example City, CA 90000 Laboratory Director: Example Person', 54, 218, 6),
    text('YY Quest Diagnostics, 20202 Ortega Hwy, Example City, CA 90000', 54, 208, 6),
    text('Key', 54, 190), text('These results have been sent to the person who ordered the tests.', 54, 85, 6),
    text('Privacy policy https://example.test/privacy Copyright 2022 Quest', 54, 73, 6),
    text('EXAMPLE,PATIENT (SYNTHETIC123) 1 / 2 8/17/25', 54, 50, 6),
  ],
  [text('EXAMPLE,PATIENT (SYNTHETIC123) 2 / 2 8/17/25', 54, 50, 6)],
  [text('These results should not be viewed as medical advice.', 54, 720, 8)],
]

/** Real PDF bytes with positioned text, generated in memory using fictional sources. */
export function labPdfFixture(pages) {
  const escaped = s => s.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
  const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const kids = []
  for (const spans of pages) {
    const pageId = objects.length + 1, contentId = pageId + 1
    kids.push(`${pageId} 0 R`)
    const stream = spans.map(s => `BT /F1 ${s.height} Tf 1 0 0 1 ${s.x} ${s.y} Tm (${escaped(s.text)}) Tj ET`).join('\n')
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`
  let file = '%PDF-1.4\n'; const offsets = [0]
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(file)); file += `${index + 1} 0 obj\n${object}\nendobj\n` }
  const start = Buffer.byteLength(file)
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
  return new Uint8Array(Buffer.from(file))
}
