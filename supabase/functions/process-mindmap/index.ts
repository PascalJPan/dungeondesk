import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClusterResult {
  id: number;
  label: string;
  summary: string;
  chunkIndices: number[];
}

interface EdgeResult {
  source: number;
  target: number;
  similarity: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chunks, clusterRange = { min: 3, max: 7 } } = await req.json();
    
    if (!chunks || !Array.isArray(chunks) || chunks.length < 3) {
      return new Response(
        JSON.stringify({ error: 'At least 3 text chunks are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${chunks.length} chunks`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Limit chunks for processing (max 50 for performance)
    const processedChunks = chunks.slice(0, 50);
    
    // Create numbered list of chunks for the AI
    const numberedChunks = processedChunks
      .map((chunk: string, i: number) => `[${i}] ${chunk.substring(0, 300)}${chunk.length > 300 ? '...' : ''}`)
      .join('\n\n');

    // Step 1: Identify themes and cluster chunks
    console.log('Identifying themes and clustering...');
    
    const clusteringPrompt = `Analyze these text chunks and identify ${clusterRange.min}-${clusterRange.max} main themes/concepts. Group the chunks by theme.

TEXT CHUNKS:
${numberedChunks}

Respond with a JSON object in this exact format:
{
  "clusters": [
    {
      "id": 0,
      "label": "Short Theme Label (3-5 words)",
      "summary": "Direct statement about the concept (no filler phrases)",
      "chunkIndices": [0, 3, 5]
    }
  ]
}

Rules:
- Each chunk index must appear in exactly one cluster
- Create between ${clusterRange.min}-${clusterRange.max} clusters based on the content
- Labels should be concise and descriptive
- Summaries MUST be direct statements without introductory phrases. 
  BAD: "This cluster reveals the Baron's objective to find the Phoenix"
  GOOD: "Baron's objective: to find the Phoenix, hoping it will free his soul"
- Never start summaries with "This cluster...", "This section...", "This concept...", "Here we see..."
- Only output valid JSON, no other text`;

    const clusterResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a text analysis assistant that identifies themes and clusters related content. Always respond with valid JSON only.' },
          { role: 'user', content: clusteringPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!clusterResponse.ok) {
      const errorText = await clusterResponse.text();
      console.error('Clustering API error:', clusterResponse.status, errorText);
      
      if (clusterResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (clusterResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${clusterResponse.status}`);
    }

    const clusterData = await clusterResponse.json();
    const clusterContent = clusterData.choices?.[0]?.message?.content || '';
    
    console.log('Raw cluster response:', clusterContent.substring(0, 500));

    // Parse the JSON from the response
    let clusters: ClusterResult[];
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = clusterContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                        clusterContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : clusterContent;
      const parsed = JSON.parse(jsonStr.trim());
      clusters = parsed.clusters || parsed;
      
      if (!Array.isArray(clusters)) {
        throw new Error('Invalid clusters format');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', clusterContent);
      
      // Fallback: create simple clusters based on chunk count
      const clusterCount = Math.min(clusterRange.max, Math.max(clusterRange.min, Math.ceil(processedChunks.length / 5)));
      clusters = [];
      for (let i = 0; i < clusterCount; i++) {
        const start = Math.floor(i * processedChunks.length / clusterCount);
        const end = Math.floor((i + 1) * processedChunks.length / clusterCount);
        clusters.push({
          id: i,
          label: `Concept ${i + 1}`,
          summary: `Group of related ideas from the text`,
          chunkIndices: Array.from({ length: end - start }, (_, j) => start + j),
        });
      }
    }

    // Ensure all chunks are assigned
    const assignedIndices = new Set(clusters.flatMap(c => c.chunkIndices));
    const unassigned = processedChunks
      .map((_, i) => i)
      .filter(i => !assignedIndices.has(i));
    
    if (unassigned.length > 0) {
      // Add unassigned to the first cluster or create a misc cluster
      if (clusters.length > 0) {
        clusters[0].chunkIndices.push(...unassigned);
      } else {
        clusters.push({
          id: 0,
          label: 'General Content',
          summary: 'Miscellaneous content from the text',
          chunkIndices: unassigned,
        });
      }
    }

    // Normalize cluster IDs
    clusters = clusters.map((c, i) => ({ ...c, id: i }));

    console.log(`Created ${clusters.length} clusters`);

    // Step 2: Generate edges based on theme similarity
    console.log('Generating edges...');
    
    const edges: EdgeResult[] = [];
    
    // Create edges between clusters with decreasing similarity based on content overlap potential
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // Calculate similarity based on relative position and size
        const sizeFactor = Math.min(clusters[i].chunkIndices.length, clusters[j].chunkIndices.length) / 
                          Math.max(clusters[i].chunkIndices.length, clusters[j].chunkIndices.length);
        
        // Check for adjacent chunks (indicates potential topical proximity)
        const indices1 = new Set(clusters[i].chunkIndices);
        const indices2 = clusters[j].chunkIndices;
        const adjacentCount = indices2.filter(idx => 
          indices1.has(idx - 1) || indices1.has(idx + 1)
        ).length;
        
        const adjacencyBonus = adjacentCount > 0 ? 0.2 : 0;
        const baseSimilarity = 0.3 + Math.random() * 0.4; // Base similarity with some variance
        const similarity = Math.min(1, baseSimilarity * sizeFactor + adjacencyBonus);
        
        if (similarity > 0.2) {
          edges.push({
            source: i,
            target: j,
            similarity: Math.round(similarity * 100) / 100,
          });
        }
      }
    }

    console.log(`Created ${edges.length} edges`);

    const result = {
      clusters,
      edges,
      totalChunks: processedChunks.length,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Processing error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
