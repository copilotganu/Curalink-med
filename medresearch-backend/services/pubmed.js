const axios = require('axios');
const { parseString } = require('xml2js');
const { promisify } = require('util');

const parseXml = promisify(parseString);

const ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

async function fetchPubMed(query, maxResults = 100) {
  try {
    // Step 1: Search for IDs
    const searchRes = await axios.get(ESEARCH_URL, {
      params: {
        db: 'pubmed',
        term: query,
        retmax: maxResults,
        sort: 'pub+date',
        retmode: 'json',
      },
      timeout: 15000,
    });

    const ids = searchRes.data?.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    console.log(`📚 PubMed: Found ${ids.length} IDs`);

    // Step 2: Fetch details in batches of 50
    const allArticles = [];
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50);
      const fetchRes = await axios.get(EFETCH_URL, {
        params: {
          db: 'pubmed',
          id: batch.join(','),
          retmode: 'xml',
        },
        timeout: 20000,
      });

      const parsed = await parseXml(fetchRes.data);
      const articles = parsed?.PubmedArticleSet?.PubmedArticle || [];

      for (const article of articles) {
        try {
          const medline = article.MedlineCitation?.[0];
          const articleData = medline?.Article?.[0];
          if (!articleData) continue;

          const pmid = medline.PMID?.[0]?._ || medline.PMID?.[0] || '';
          const title = articleData.ArticleTitle?.[0] || '';
          const abstractTexts = articleData.Abstract?.[0]?.AbstractText || [];
          const abstract = abstractTexts.map(t => (typeof t === 'string' ? t : t._ || '')).join(' ');

          const authorList = articleData.AuthorList?.[0]?.Author || [];
          const authors = authorList.map(a => {
            const last = a.LastName?.[0] || '';
            const initials = a.Initials?.[0] || '';
            return `${last} ${initials}`.trim();
          }).filter(Boolean);

          const pubDate = articleData.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0];
          const year = parseInt(pubDate?.Year?.[0] || pubDate?.MedlineDate?.[0]?.substring(0, 4) || '0');

          allArticles.push({
            title,
            abstract,
            authors,
            year,
            source: 'PubMed',
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}`,
          });
        } catch (e) {
          // Skip malformed articles
        }
      }
    }

    console.log(`📚 PubMed: Parsed ${allArticles.length} articles`);
    return allArticles;
  } catch (error) {
    console.error('PubMed fetch error:', error.message);
    return [];
  }
}

module.exports = { fetchPubMed };
