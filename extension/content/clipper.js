// Academic Literature Clipper Content Script
(function() {
  function extractAcademicMetadata() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    let title = '';
    let authors = [];
    let abstract = '';
    let doi = '';
    let journal = '';
    let year = '';

    // 1. Google Scholar
    if (hostname.includes('scholar.google')) {
      const activeTitleEl = document.querySelector('.gs_rt a, .gs_rt');
      title = activeTitleEl ? activeTitleEl.innerText.replace(/^[[(].*?[])]s*/, '').trim() : document.title;
      
      const authorEl = document.querySelector('.gs_a');
      if (authorEl) {
        const parts = authorEl.innerText.split('-');
        if (parts.length > 0) authors = parts[0].split(',').map(a => a.trim()).filter(Boolean);
        if (parts.length > 1) {
          const matchYear = parts[1].match(/\b(19|20)\d{2}\b/);
          if (matchYear) year = matchYear[0];
          journal = parts[1].replace(/\b(19|20)\d{2}\b/, '').replace(/,/g, '').trim();
        }
      }
      const absEl = document.querySelector('.gs_rs');
      if (absEl) abstract = absEl.innerText.trim();
    }
    // 2. PubMed
    else if (hostname.includes('pubmed.ncbi.nlm.nih.gov')) {
      const titleEl = document.querySelector('.heading-title, h1.heading-title');
      title = titleEl ? titleEl.innerText.trim() : document.title;

      const authorEls = document.querySelectorAll('.authors-list-item .full-name, .full-view .authors .full-name');
      authorEls.forEach(el => authors.push(el.innerText.trim()));

      const doiEl = document.querySelector('.citation-doi, .identifier.doi a, span.citation-doi');
      if (doiEl) {
        const rawDoi = doiEl.innerText.trim();
        const match = rawDoi.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
        doi = match ? match[0] : rawDoi.replace(/^doi:\s*/i, '').trim();
      }

      const absEl = document.querySelector('.abstract-content, #abstract');
      if (absEl) abstract = absEl.innerText.replace(/^\s*Abstract\s*/i, '').trim();

      const citJournalEl = document.querySelector('.journal-actions button, .cit');
      if (citJournalEl) journal = citJournalEl.innerText.trim();
    }
    // 3. IEEE Xplore
    else if (hostname.includes('ieeexplore.ieee.org')) {
      const titleEl = document.querySelector('.document-title span, h1.document-title');
      title = titleEl ? titleEl.innerText.trim() : document.title;

      const authorEls = document.querySelectorAll('.authors-info-container span a, .author-card span');
      authorEls.forEach(el => authors.push(el.innerText.trim()));

      const absEl = document.querySelector('.abstract-text, .u-mb-1 div');
      if (absEl) abstract = absEl.innerText.replace(/^\s*Abstract:\s*/i, '').trim();

      const doiEl = document.querySelector('.stats-document-abstract-doi, a[href*="doi.org"]');
      if (doiEl) {
        const match = doiEl.innerText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
        if (match) doi = match[0];
      }
    }
    // 4. ScienceDirect
    else if (hostname.includes('sciencedirect.com')) {
      const titleEl = document.querySelector('.title-text, h1.article-title');
      title = titleEl ? titleEl.innerText.trim() : document.title;

      const authorEls = document.querySelectorAll('.author-group .author, .author-group .text');
      authorEls.forEach(el => authors.push(el.innerText.trim()));

      const absEl = document.querySelector('.abstract, .abstract.author');
      if (absEl) abstract = absEl.innerText.replace(/^\s*Abstract\s*/i, '').trim();

      const doiEl = document.querySelector('.doi, a[href*="doi.org"]');
      if (doiEl) {
        const match = doiEl.href.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i) || doiEl.innerText.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
        if (match) doi = match[0];
      }
    }

    // 5. Standard Highwire / Dublin Core / OpenGraph Meta Fallback
    if (!title) {
      const metaTitle = document.querySelector('meta[name="citation_title"], meta[name="dc.title"], meta[property="og:title"]');
      if (metaTitle) title = metaTitle.content;
    }
    if (authors.length === 0) {
      const metaAuthors = document.querySelectorAll('meta[name="citation_author"], meta[name="dc.creator"]');
      metaAuthors.forEach(m => authors.push(m.content));
    }
    if (!doi) {
      const metaDoi = document.querySelector('meta[name="citation_doi"], meta[name="dc.identifier"], meta[name="dc.Identifier"]');
      if (metaDoi) {
        const match = metaDoi.content.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
        doi = match ? match[0] : metaDoi.content;
      }
    }
    if (!abstract) {
      const metaAbs = document.querySelector('meta[name="citation_abstract"], meta[name="description"], meta[property="og:description"]');
      if (metaAbs) abstract = metaAbs.content;
    }
    if (!journal) {
      const metaJournal = document.querySelector('meta[name="citation_journal_title"], meta[name="citation_conference_title"]');
      if (metaJournal) journal = metaJournal.content;
    }
    if (!year) {
      const metaDate = document.querySelector('meta[name="citation_publication_date"], meta[name="citation_date"], meta[name="dc.date"]');
      if (metaDate) {
        const match = metaDate.content.match(/\b(19|20)\d{2}\b/);
        if (match) year = match[0];
      }
    }

    if (!title) title = document.title;

    return {
      title: title.trim(),
      authors: Array.from(new Set(authors.map(a => a.trim()).filter(Boolean))),
      doi: doi.trim(),
      abstract: abstract.trim(),
      journal: journal.trim(),
      year: year.trim(),
      url: url,
      sourceDomain: hostname
    };
  }

  // Inject Floating Quick-Clip Badge
  function injectFloatingClipButton() {
    if (document.getElementById('noun-hrms-floating-clipper')) return;

    const btn = document.createElement('div');
    btn.id = 'noun-hrms-floating-clipper';
    btn.innerHTML = `
      <div class="noun-clipper-icon">🏛️</div>
      <span class="noun-clipper-text">Clip to NOUN Research</span>
    `;
    btn.title = 'Save academic paper to NOUN Research Forum Workspace';

    btn.addEventListener('click', async () => {
      btn.classList.add('noun-clipper-loading');
      btn.querySelector('.noun-clipper-text').innerText = 'Extracting...';

      const metadata = extractAcademicMetadata();

      // Send to background to handle workspace selection or direct save
      chrome.runtime.sendMessage({
        type: 'QUICK_CLIP_TRIGGERED',
        payload: metadata
      }, (response) => {
        btn.classList.remove('noun-clipper-loading');
        if (response?.success) {
          btn.classList.add('noun-clipper-success');
          btn.querySelector('.noun-clipper-text').innerText = 'Saved to NOUN!';
          setTimeout(() => {
            btn.classList.remove('noun-clipper-success');
            btn.querySelector('.noun-clipper-text').innerText = 'Clip to NOUN Research';
          }, 3000);
        } else {
          // Open popup if auth or project selection needed
          btn.querySelector('.noun-clipper-text').innerText = 'Open Extension Popup';
          setTimeout(() => {
            btn.querySelector('.noun-clipper-text').innerText = 'Clip to NOUN Research';
          }, 2500);
        }
      });
    });

    document.body.appendChild(btn);
  }

  // Initialize
  setTimeout(injectFloatingClipButton, 1000);

  // Message Handler for Popup / Background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'GET_ACADEMIC_METADATA') {
      const data = extractAcademicMetadata();
      sendResponse(data);
    }
    return true;
  });
})();
