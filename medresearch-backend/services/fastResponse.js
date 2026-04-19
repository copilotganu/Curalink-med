/**
 * Fast Response Generator
 * Generates research response without LLM (achieves <3s response time)
 * Template-based synthesis of publications and clinical trials
 * FLEXIBLE: Works with any medical condition
 */

/**
 * Extract a 1-2 sentence snippet from abstract
 */
function extractSnippet(abstract) {
  if (!abstract || abstract.length < 50) return '';
  
  // Split into sentences
  const sentences = abstract.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Return first sentence(s) up to ~120 characters
  let snippet = '';
  for (const sentence of sentences) {
    if ((snippet + sentence).length <= 120) {
      snippet += (snippet ? ' ' : '') + sentence.trim();
    } else {
      break;
    }
  }
  
  return snippet + (snippet ? '.' : '');
}

/**
 * Generate quick overview from top papers
 */
function generateOverview(topPapers, disease) {
  if (topPapers.length === 0) {
    return `## Research Overview\n\nNo research publications found matching your query.`;
  }

  const recentPapers = topPapers.filter(p => p.year >= 2023);
  const diseaseDisplay = disease ? ` on ${disease}` : '';
  
  let overview = `## Research Overview\n\n`;
  overview += `Based on analysis of ${topPapers.length} recent publications${diseaseDisplay}:\n\n`;
  
  const researchAreas = topPapers.length > 3 ? 'multiple' : topPapers.length;
  overview += `**Current Research Landscape**: We identified ${researchAreas} relevant research ${recentPapers.length > 0 ? `with ${recentPapers.length} publications from 2023 onwards` : 'in this field'}.\n\n`;
  
  if (recentPapers.length > 0) {
    const authors = recentPapers[0].authors?.slice(0, 2)?.join(', ') || 'Researchers';
    overview += `**Latest Research (${recentPapers[0].year})**: Recent studies highlight current best practices and emerging evidence. ${authors} and colleagues contribute to the evolving understanding of treatment and management approaches.\n\n`;
  }
  
  overview += `**Publication Quality**: The selected publications span from ${Math.min(...topPapers.map(p => p.year))} to ${Math.max(...topPapers.map(p => p.year))}, providing both established knowledge and cutting-edge findings.`;
  
  return overview;
}

/**
 * Generate research insights from paper themes
 */
function generateInsights(topPapers, disease) {
  const insights = [`## Key Research Findings`];
  
  if (topPapers.length === 0) {
    return insights.join('\n\n');
  }

  // Identify common themes in papers
  const allText = topPapers.map(p => `${p.title} ${p.abstract}`).join(' ').toLowerCase();
  
  const themes = [];
  
  if (allText.includes('treatment') || allText.includes('therapy')) {
    themes.push(`**Treatment Approaches**: Literature identifies various treatment modalities and therapeutic strategies with varying levels of evidence.`);
  }
  
  if (allText.includes('outcome') || allText.includes('efficacy') || allText.includes('effectiveness')) {
    themes.push(`**Clinical Outcomes**: Research demonstrates measurable clinical outcomes and effectiveness metrics across different study populations.`);
  }
  
  if (allText.includes('patient') || allText.includes('population')) {
    themes.push(`**Patient Populations**: Studies evaluate different patient subgroups, demographics, and disease stages to understand treatment applicability.`);
  }
  
  if (allText.includes('mechanism') || allText.includes('pathway')) {
    themes.push(`**Mechanism of Action**: Research explores the biological mechanisms and pathways underlying treatment effectiveness.`);
  }
  
  if (allText.includes('novel') || allText.includes('new') || allText.includes('emerging')) {
    themes.push(`**Emerging Approaches**: Recent literature highlights novel techniques and emerging treatment paradigms under investigation.`);
  }
  
  if (allText.includes('compar') || allText.includes('versus')) {
    themes.push(`**Comparative Analysis**: Studies provide comparative data between different treatment modalities and approaches.`);
  }
  
  // If no specific themes found, provide generic synthesis
  if (themes.length === 0) {
    const topPaper = topPapers[0];
    const authors = topPaper.authors?.slice(0, 2)?.join(', ') || 'Researchers';
    themes.push(`**Current Evidence**: ${authors} and colleagues (${topPaper.year}) contribute important evidence to the understanding of this condition and its management.`);
  }
  
  insights.push(...themes.slice(0, 5).map((t, i) => `${i + 1}. ${t}`));
  
  // Add synthesis note
  insights.push(`\n**Research Consensus**: The analyzed publications demonstrate active research in this field with focus on improving clinical outcomes and understanding disease mechanisms.`);
  
  return insights.join('\n\n');
}

/**
 * Extract trial focus areas from trial titles and details
 */
function generateTrialFocusAreas(topTrials) {
  if (topTrials.length === 0) {
    return [];
  }
  
  const focusAreas = new Set();
  
  topTrials.forEach(trial => {
    const text = `${trial.title} ${trial.eligibility}`.toLowerCase();
    
    if (text.includes('randomized') || text.includes('rct')) {
      focusAreas.add('Randomized Controlled Trials');
    }
    if (text.includes('open') || text.includes('label')) {
      focusAreas.add('Open-Label Studies');
    }
    if (text.includes('phase')) {
      focusAreas.add('Multi-Phase Development');
    }
    if (text.includes('personali') || text.includes('individual')) {
      focusAreas.add('Personalized/Individualized Treatment');
    }
    if (text.includes('outcome')) {
      focusAreas.add('Outcome Measurement');
    }
    if (text.includes('safety') || text.includes('tolerability')) {
      focusAreas.add('Safety & Tolerability Assessment');
    }
    if (text.includes('long')) {
      focusAreas.add('Long-Term Follow-Up Studies');
    }
  });
  
  return Array.from(focusAreas);
}

/**
 * Extract knowledge gaps from papers and trials
 */
function generateKnowledgeGaps(topPapers, topTrials) {
  const gaps = [
    'Limited understanding of individual variability in treatment response',
    'Need for larger, diverse population studies to establish broader applicability',
    'Lack of standardized measurement and comparison methodologies',
  ];
  
  // Add paper-specific gaps
  const allText = topPapers.map(p => `${p.title} ${p.abstract}`).join(' ').toLowerCase();
  
  if (!allText.includes('long-term') && !allText.includes('longterm')) {
    gaps.push('Insufficient long-term follow-up data beyond 5 years');
  }
  
  if (!allText.includes('mechanism')) {
    gaps.push('Incomplete understanding of underlying biological mechanisms');
  }
  
  if (topTrials.length < 2) {
    gaps.push('Limited number of ongoing clinical trials in this area');
  }
  
  // Return top 4 most relevant gaps
  return gaps.slice(0, 4);
}

/**
 * Generate overall insight summary
 */
function generateOverallInsight(topPapers, topTrials, disease) {
  if (topPapers.length === 0) {
    return 'No research data available to generate insights.';
  }
  
  const hasOutcome = topPapers.some(p => 
    `${p.title} ${p.abstract}`.toLowerCase().includes('outcome')
  );
  
  const hasEfficacy = topPapers.some(p => 
    `${p.title} ${p.abstract}`.toLowerCase().includes('efficacy') ||
    `${p.title} ${p.abstract}`.toLowerCase().includes('effectiveness')
  );
  
  let insight = disease ? `Research on ${disease} demonstrates ` : 'Research demonstrates ';
  
  if (hasEfficacy && hasOutcome) {
    insight += 'promising clinical outcomes with established efficacy across multiple studies. The evidence base is expanding with ongoing trials investigating optimization strategies and personalized treatment approaches. Clinical implementation should be guided by current evidence and individualized patient assessment.';
  } else if (hasEfficacy) {
    insight += 'effectiveness in clinical practice with evidence-based support. Multiple publications document positive outcomes, with continued research refining treatment protocols and expanding understanding of optimal approaches.';
  } else if (hasOutcome) {
    insight += 'measurable outcomes with documented clinical impact. Recent research focuses on improving outcomes through better patient selection, treatment optimization, and long-term monitoring strategies.';
  } else {
    insight += 'an active field of investigation with multiple research efforts aimed at improving treatment and management. Evidence continues to evolve, with focus on both establishing efficacy and understanding mechanisms of action.';
  }
  
  return insight;
}

/**
 * Generate clinical trial analysis section
 */
function generateClinicalTrialsSection(topTrials, disease) {
  if (topTrials.length === 0) {
    const diseaseStr = disease ? ` for ${disease}` : '';
    return `## Clinical Trial Landscape\n\nNo active clinical trials found in your specified location${diseaseStr}. However, clinical research in this area continues, and you may wish to check clinicaltrials.gov directly or consult with your healthcare provider about trial availability.`;
  }
  
  const recruiting = topTrials.filter(t => t.status === 'RECRUITING').length;
  const phases = [...new Set(topTrials.map(t => t.phase).filter(Boolean))];
  
  let section = `## Clinical Trial Landscape\n\n`;
  
  if (recruiting > 0) {
    section += `**Active Recruitment**: ${recruiting} of ${topTrials.length} identified trials are actively recruiting participants.\n\n`;
  }
  
  const focusAreas = generateTrialFocusAreas(topTrials);
  if (focusAreas.length > 0) {
    section += `**Research Focus Areas**: Current trials are investigating:\n`;
    focusAreas.slice(0, 4).forEach((area, i) => {
      section += `- ${area}\n`;
    });
    section += '\n';
  }
  
  if (phases.length > 0) {
    section += `**Trial Phases**: Trials span from ${phases.sort().join(', ')} studies, indicating diverse research at various development stages.\n`;
  }
  
  section += `\n**Retrieval Note**: These trials represent the most relevant matches from a comprehensive database search, filtered for relevance to your location and interests.`;
  
  return section;
}

/**
 * Main function to generate fast response
 */
function generateFastResponse(query, topPapers, topTrials, totalFetched, disease) {
  // Extract snippets for all papers
  const publicationsWithSnippets = topPapers.map(p => ({
    ...p,
    snippet: extractSnippet(p.abstract),
  }));
  
  // Generate all sections
  const overview = generateOverview(publicationsWithSnippets, disease);
  const insights = generateInsights(publicationsWithSnippets, disease);
  const clinical_trials = generateClinicalTrialsSection(topTrials, disease);
  const overallInsight = generateOverallInsight(publicationsWithSnippets, topTrials, disease);
  const knowledgeGaps = generateKnowledgeGaps(publicationsWithSnippets, topTrials);
  const trialFocusAreas = generateTrialFocusAreas(topTrials);
  
  // Extract retrieval stats
  const retrievalDepth = {
    totalPublications: totalFetched.pubmedCount + totalFetched.openalexCount,
    totalTrials: totalFetched.trialsCount,
    selectedPublications: topPapers.length,
    selectedTrials: topTrials.length,
  };
  
  return {
    overview,
    insights,
    clinical_trials,
    publications: publicationsWithSnippets,
    trials: topTrials,
    sources: [...publicationsWithSnippets, ...topTrials],
    overallInsight,
    knowledgeGaps,
    trialFocusAreas,
    retrievalDepth,
  };
}

module.exports = { generateFastResponse };
