# MedResearch AI — Backend

Medical Research Assistant backend with RAG pipeline using Express, MongoDB, and Ollama.

## Architecture

```
User Query → Query Expansion → Parallel API Fetch (PubMed + OpenAlex + ClinicalTrials.gov)
           → Deduplication → Ranking/Scoring → Top Selection → Ollama LLM → Structured Response
```

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally or Atlas URI
- Ollama installed with a model (e.g., `ollama pull mistral`)

### Install & Run

```bash
cp .env.example .env
# Edit .env with your MongoDB URI and Ollama settings

npm install
npm run dev
```

### API

**POST /api/query**
```json
{
  "query": "Latest treatment for lung cancer",
  "context": {
    "disease": "lung cancer",
    "location": "Toronto, Canada"
  },
  "conversationId": "optional-uuid"
}
```

## Folder Structure

```
├── server.js              # Express entry point
├── routes/query.js        # Main query endpoint (full pipeline)
├── services/
│   ├── queryExpander.js   # Query expansion with synonyms
│   ├── pubmed.js          # PubMed API (esearch + efetch)
│   ├── openalex.js        # OpenAlex API
│   ├── clinicalTrials.js  # ClinicalTrials.gov API v2
│   ├── ranker.js          # Scoring & ranking pipeline
│   └── llm.js             # Ollama LLM integration
├── models/
│   └── Conversation.js    # MongoDB conversation schema
└── .env.example
```

## Design Decisions

- **Deep retrieval first**: Fetches 100+ results per source before filtering
- **Keyword-based ranking**: +2 disease in title, +2 abstract match, +1 recency — simple and transparent
- **Deduplication**: Normalized title matching across PubMed and OpenAlex
- **Ollama fallback**: If LLM is unavailable, generates structured response from ranked data
- **Context awareness**: Conversation history stored in MongoDB, sent to LLM for follow-ups
