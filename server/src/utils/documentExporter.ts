import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

// Helper to strip HTML tags for simple text extraction
function cleanHtmlText(html: string): string {
    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

// Struct to represent a parsed document element
interface DocElement {
    type: 'p' | 'h2' | 'h3' | 'blockquote' | 'ul' | 'ol' | 'math';
    text: string;
    items?: string[]; // for lists
}

// Robust HTML block parser
function parseHtmlToElements(html: string): DocElement[] {
    const elements: DocElement[] = [];
    if (!html) return elements;

    // Convert common block tags into standard line breaks or separators
    let formatted = html
        .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n[H2]$1\n')
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n[H2]$1\n')
        .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n[H3]$1\n')
        .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n[H3]$1\n')
        .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n[BLOCKQUOTE]$1\n')
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n[P]$1\n')
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n[LI]$1\n')
        .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, '\n[P]$1\n')
        .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n[P]$1\n');

    // Split by newlines and parse each line
    const lines = formatted.split('\n');
    let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // If list item, append to list
        if (trimmed.startsWith('[LI]')) {
            const cleanText = cleanHtmlText(trimmed.substring(4));
            if (!cleanText) continue;
            if (!currentList) {
                currentList = { type: 'ul', items: [] };
            }
            currentList.items.push(cleanText);
            continue;
        }

        // Push active list first if we exit list state
        if (currentList) {
            elements.push({ type: currentList.type, text: '', items: currentList.items });
            currentList = null;
        }

        if (trimmed.startsWith('[H2]')) {
            elements.push({ type: 'h2', text: cleanHtmlText(trimmed.substring(4)) });
        } else if (trimmed.startsWith('[H3]')) {
            elements.push({ type: 'h3', text: cleanHtmlText(trimmed.substring(4)) });
        } else if (trimmed.startsWith('[BLOCKQUOTE]')) {
            elements.push({ type: 'blockquote', text: cleanHtmlText(trimmed.substring(12)) });
        } else if (trimmed.startsWith('[P]')) {
            const cleanText = cleanHtmlText(trimmed.substring(3));
            if (!cleanText) continue;
            
            // Check for math block
            if (cleanText.startsWith('$$') && cleanText.endsWith('$$')) {
                elements.push({ type: 'math', text: cleanText.substring(2, cleanText.length - 2).trim() });
            } else if (cleanText.includes('$$')) {
                const parts = cleanText.split('$$');
                parts.forEach((part, index) => {
                    const text = part.trim();
                    if (!text) return;
                    if (index % 2 === 1) {
                        elements.push({ type: 'math', text });
                    } else {
                        elements.push({ type: 'p', text });
                    }
                });
            } else {
                elements.push({ type: 'p', text: cleanText });
            }
        } else {
            const cleanText = cleanHtmlText(trimmed);
            if (cleanText) {
                elements.push({ type: 'p', text: cleanText });
            }
        }
    }

    if (currentList) {
        elements.push({ type: currentList.type, text: '', items: currentList.items });
    }

    return elements;
}

/**
 * PDF Exporter using PDFKit
 */
export function generatePDF(title: string, contentHtml: string, doubleSpaced: boolean): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: 72, // 1 inch margin
                bufferPages: true
            });

            const chunks: Buffer[] = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            const elements = parseHtmlToElements(contentHtml);
            const lineGap = doubleSpaced ? 12 : 4;

            // Title Page / Header
            doc.font('Times-Roman').fontSize(24).text(title, { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(12).text('Collaborative Research Document', { align: 'center' });
            doc.text(`Export Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown(2);

            // Document Body
            elements.forEach(el => {
                if (el.type === 'h2') {
                    doc.font('Times-Bold').fontSize(16).text(el.text, { lineGap: 6 });
                    doc.moveDown(0.5);
                } else if (el.type === 'h3') {
                    doc.font('Times-Bold').fontSize(14).text(el.text, { lineGap: 4 });
                    doc.moveDown(0.5);
                } else if (el.type === 'p') {
                    doc.font('Times-Roman').fontSize(12).text(el.text, { align: 'justify', lineGap });
                    doc.moveDown(0.8);
                } else if (el.type === 'blockquote') {
                    doc.font('Times-Italic').fontSize(11).text(el.text, { indent: 36, lineGap });
                    doc.moveDown(0.8);
                } else if (el.type === 'math') {
                    doc.font('Courier').fontSize(11).text(`[LaTeX Equation] ${el.text}`, { align: 'center', lineGap: 8 });
                    doc.moveDown(0.8);
                } else if (el.type === 'ul' && el.items) {
                    doc.font('Times-Roman').fontSize(12);
                    el.items.forEach(item => {
                        doc.text(`•  ${item}`, { indent: 18, lineGap });
                    });
                    doc.moveDown(0.8);
                } else if (el.type === 'ol' && el.items) {
                    doc.font('Times-Roman').fontSize(12);
                    el.items.forEach((item, idx) => {
                        doc.text(`${idx + 1}.  ${item}`, { indent: 18, lineGap });
                    });
                    doc.moveDown(0.8);
                }
            });

            // Global Page Numbers footer
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.font('Times-Roman').fontSize(10).text(
                    `Page ${i + 1} of ${range.count}`,
                    72,
                    doc.page.height - 50,
                    { align: 'center' }
                );
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * DOCX Exporter using docx library
 */
export async function generateDOCX(title: string, contentHtml: string, doubleSpaced: boolean): Promise<Buffer> {
    const elements = parseHtmlToElements(contentHtml);
    const lineSpacing = doubleSpaced ? 480 : 240; // 480 twips = 2.0 (double spacing)

    const docChildren: Paragraph[] = [
        new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
        }),
        new Paragraph({
            text: `Export Date: ${new Date().toLocaleDateString()}`,
            spacing: { after: 400 }
        })
    ];

    elements.forEach(el => {
        if (el.type === 'h2') {
            docChildren.push(
                new Paragraph({
                    text: el.text,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 240, after: 120 }
                })
            );
        } else if (el.type === 'h3') {
            docChildren.push(
                new Paragraph({
                    text: el.text,
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 180, after: 80 }
                })
            );
        } else if (el.type === 'p') {
            docChildren.push(
                new Paragraph({
                    children: [new TextRun({ text: el.text, font: 'Times New Roman', size: 24 })],
                    spacing: { line: lineSpacing, after: 180 }
                })
            );
        } else if (el.type === 'blockquote') {
            docChildren.push(
                new Paragraph({
                    children: [new TextRun({ text: el.text, font: 'Times New Roman', size: 22, italics: true })],
                    indent: { left: 720 }, // 0.5 inch indent
                    spacing: { line: lineSpacing, after: 180 }
                })
            );
        } else if (el.type === 'math') {
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `[LaTeX Equation] ${el.text}`, font: 'Courier New', size: 22 })
                    ],
                    alignment: 'center',
                    spacing: { before: 120, after: 120 }
                })
            );
        } else if (el.type === 'ul' && el.items) {
            el.items.forEach(item => {
                docChildren.push(
                    new Paragraph({
                        children: [new TextRun({ text: item, font: 'Times New Roman', size: 24 })],
                        bullet: { level: 0 },
                        spacing: { line: lineSpacing, after: 80 }
                    })
                );
            });
        } else if (el.type === 'ol' && el.items) {
            el.items.forEach((item, idx) => {
                docChildren.push(
                    new Paragraph({
                        children: [new TextRun({ text: `${idx + 1}. ${item}`, font: 'Times New Roman', size: 24 })],
                        indent: { left: 360 },
                        spacing: { line: lineSpacing, after: 80 }
                    })
                );
            });
        }
    });

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 1440, // 1 inch = 1440 twips
                        bottom: 1440,
                        left: 1440,
                        right: 1440
                    }
                }
            },
            children: docChildren
        }]
    });

    return await Packer.toBuffer(doc);
}

/**
 * LaTeX (.tex) exporter
 */
export function generateLaTeX(title: string, contentHtml: string): string {
    const elements = parseHtmlToElements(contentHtml);
    let latex = `% Standard Academic Document
\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{${title}}
\\author{Collaborative Research Team}
\\date{\\today}

\\begin{document}
\\maketitle

`;

    elements.forEach(el => {
        if (el.type === 'h2') {
            latex += `\\section{${el.text}}\n\n`;
        } else if (el.type === 'h3') {
            latex += `\\subsection{${el.text}}\n\n`;
        } else if (el.type === 'p') {
            latex += `${el.text}\n\n`;
        } else if (el.type === 'blockquote') {
            latex += `\\begin{quote}\n${el.text}\n\\end{quote}\n\n`;
        } else if (el.type === 'math') {
            latex += `\\begin{equation}\n${el.text}\n\\end{equation}\n\n`;
        } else if (el.type === 'ul' && el.items) {
            latex += `\\begin{itemize}\n`;
            el.items.forEach(item => {
                latex += `  \\item ${item}\n`;
            });
            latex += `\\end{itemize}\n\n`;
        } else if (el.type === 'ol' && el.items) {
            latex += `\\begin{enumerate}\n`;
            el.items.forEach(item => {
                latex += `  \\item ${item}\n`;
            });
            latex += `\\end{enumerate}\n\n`;
        }
    });

    latex += `\\end{document}\n`;
    return latex;
}
