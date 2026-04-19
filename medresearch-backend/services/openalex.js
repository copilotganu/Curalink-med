const axios = require('axios');

const BASE_URL = 'https://api.openalex.org/works';

async function fetchOpenAlex(query, maxResults = 100) {
  try {
    const perPage = Math.min(maxResults, 200);
    const pages = Math.ceil(maxResults / perPage);
    const allWorks = [];

    for (let page = 1; page <= pages; page++) {
      const res = await axios.get(BASE_URL, {
        params: {
          search: query,
          'per-page': perPage,
          page,
          sort: 'relevance_score:desc',
          filter: `from_publication_date:2018-01-01,to_publication_date:2025-12-31`,
        },
        timeout: 15000,
      });

      const works = res.data?.results || [];
      console.log(`🌐 OpenAlex page ${page}: ${works.length} results`);

      for (const work of works) {
        const title = work.title || '';
        const abstract = reconstructAbstract(work.abstract_inverted_index);
        const authors = (work.authorships || [])
          .map(a => a.author?.display_name || '')
          .filter(Boolean)
          .slice(0, 5);
        const year = work.publication_year || 0;
        const url = work.doi ? `https://doi.org/${work.doi.replace('https://doi.org/', '')}` : work.id || '';

        allWorks.push({
          title,
          abstract,
          authors,
          year,
          source: 'OpenAlex',
          url,
        });
      }
    }

    console.log(`🌐 OpenAlex: Total ${allWorks.length} works`);
    return allWorks;
  } catch (error) {
    console.error('OpenAlex fetch error:', error.message);
    return [];
  }
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(' ').substring(0, 1000);
}

module.exports = { fetchOpenAlex };
