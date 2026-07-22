import { generatePDF, generateDOCX, generateLaTeX } from '../utils/documentExporter';

const runTests = async () => {
    console.log('🧪 Starting Academic Exporters Performance & Integrity Tests...');

    // 1. Construct a heavy document content representation
    const sampleTitle = 'Assessment of Machine Learning in Higher Education';
    
    let heavyHtmlContent = '<h2>Abstract</h2>';
    heavyHtmlContent += '<p>This study evaluates the deployment of advanced predictive analytics within administrative structures.</p>';
    
    // Add multiple LaTeX formula tags
    heavyHtmlContent += '<h2>Mathematical Formulation</h2>';
    for (let i = 0; i < 20; i++) {
        heavyHtmlContent += `<p>Equation ${i + 1} represents the optimization constraint:</p>`;
        heavyHtmlContent += `<p>$$\\sum_{k=1}^{n} w_k x_k^2 + \\beta_k \\geq \\theta_0$$</p>`;
    }

    // Add bullet and numbered lists
    heavyHtmlContent += '<h2>Evaluation Criteria</h2>';
    heavyHtmlContent += '<ul>';
    for (let j = 0; j < 30; j++) {
        heavyHtmlContent += `<li>Criterion ${j + 1} checks if performance threshold is met.</li>`;
    }
    heavyHtmlContent += '</ul>';

    heavyHtmlContent += '<h2>Steps for Implementation</h2>';
    heavyHtmlContent += '<ol>';
    for (let k = 0; k < 20; k++) {
        heavyHtmlContent += `<li>Phase ${k + 1}: Deploy monitoring nodes and gather telemetry.</li>`;
    }
    heavyHtmlContent += '</ol>';

    heavyHtmlContent += '<blockquote>This represents the formal citation baseline for all institutional audits.</blockquote>';

    try {
        // Test PDF Export
        console.log('🔄 Rendering heavy PDF document with PDFKit...');
        const pdfStartTime = Date.now();
        const pdfBuffer = await generatePDF(sampleTitle, heavyHtmlContent, true);
        const pdfDuration = Date.now() - pdfStartTime;

        if (pdfBuffer && pdfBuffer.length > 0) {
            console.log(`✅ PASS: PDF generated successfully in ${pdfDuration}ms (Buffer size: ${pdfBuffer.length} bytes)`);
        } else {
            throw new Error('FAIL: PDF generated empty buffer');
        }

        // Test DOCX Export
        console.log('🔄 Compiling heavy DOCX document with docx Packer...');
        const docxStartTime = Date.now();
        const docxBuffer = await generateDOCX(sampleTitle, heavyHtmlContent, true);
        const docxDuration = Date.now() - docxStartTime;

        if (docxBuffer && docxBuffer.length > 0) {
            console.log(`✅ PASS: DOCX generated successfully in ${docxDuration}ms (Buffer size: ${docxBuffer.length} bytes)`);
        } else {
            throw new Error('FAIL: DOCX generated empty buffer');
        }

        // Test LaTeX Export
        console.log('🔄 Mapping HTML to plain-text LaTeX structure...');
        const latexStartTime = Date.now();
        const latexString = generateLaTeX(sampleTitle, heavyHtmlContent);
        const latexDuration = Date.now() - latexStartTime;

        if (latexString && latexString.includes('\\begin{document}') && latexString.includes('\\end{document}')) {
            console.log(`✅ PASS: LaTeX generated successfully in ${latexDuration}ms (Length: ${latexString.length} chars)`);
        } else {
            throw new Error('FAIL: LaTeX string structure invalid');
        }

    } catch (err) {
        console.error('❌ FAIL: Document Exporters test failed:', err);
        process.exit(1);
    }

    console.log('\n🎉 Exporter Performance Tests complete: all checks passed.');
};

runTests();
