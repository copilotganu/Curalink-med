const axios = require('axios');

const BASE_URL = 'https://clinicaltrials.gov/api/v2/studies';

async function fetchClinicalTrials(condition, intervention = '', location = '', maxResults = 50) {
  try {
    const params = {
      'query.cond': condition,
      pageSize: Math.min(maxResults, 100),
      format: 'json',
    };

    if (intervention) params['query.intr'] = intervention;
    if (location) params['query.locn'] = location;

    // Fetch recruiting first, then all statuses
    const results = [];

    // Recruiting trials
    const recruitingRes = await axios.get(BASE_URL, {
      params: { ...params, 'filter.overallStatus': 'RECRUITING' },
      timeout: 15000,
    });
    const recruitingStudies = recruitingRes.data?.studies || [];
    console.log(`🧪 ClinicalTrials (recruiting): ${recruitingStudies.length}`);
    results.push(...recruitingStudies);

    // Active trials
    const activeRes = await axios.get(BASE_URL, {
      params: { ...params, 'filter.overallStatus': 'ACTIVE_NOT_RECRUITING' },
      timeout: 15000,
    });
    const activeStudies = activeRes.data?.studies || [];
    console.log(`🧪 ClinicalTrials (active): ${activeStudies.length}`);
    results.push(...activeStudies);

    // Normalize
    return results.map(study => {
      const proto = study.protocolSection || {};
      const id = proto.identificationModule || {};
      const status = proto.statusModule || {};
      const eligibility = proto.eligibilityModule || {};
      const contacts = proto.contactsLocationsModule || {};
      const locations = contacts.locations || [];

      const locationStr = locations.length > 0
        ? locations.slice(0, 3).map(l => `${l.city || ''}, ${l.country || ''}`).join('; ')
        : location || 'Multiple sites';

      const contactList = contacts.centralContacts || [];
      const contactStr = contactList.length > 0
        ? `${contactList[0].name || 'N/A'} — ${contactList[0].email || 'N/A'}`
        : 'See trial listing';

      return {
        title: id.officialTitle || id.briefTitle || '',
        status: status.overallStatus || 'UNKNOWN',
        eligibility: eligibility.eligibilityCriteria?.substring(0, 300) || 'See trial listing',
        location: locationStr,
        contact: contactStr,
        url: `https://clinicaltrials.gov/study/${id.nctId || ''}`,
      };
    });
  } catch (error) {
    console.error('ClinicalTrials fetch error:', error.message);
    return [];
  }
}

module.exports = { fetchClinicalTrials };
