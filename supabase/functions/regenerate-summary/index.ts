import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EntityInput {
  id: string;
  type: string;
  label: string;
  excerpts: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entities } = await req.json() as { entities: EntityInput[] };
    
    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one entity is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Regenerating summaries for ${entities.length} entities`);

    const summaries: { id: string; summary: string }[] = [];

    for (const entity of entities) {
      const excerptText = entity.excerpts
        .map((e, i) => `[${i + 1}] ${e}`)
        .join('\n\n');

      const prompt = `You are summarizing a D&D campaign ${entity.type} named "${entity.label}".

Based on these excerpts from the campaign notes:

${excerptText}

Write a concise 2-4 sentence summary that captures the key details about this ${entity.type}.

Rules:
1. Write as direct statements, never starting with "This is..." or "This ${entity.type}..."
2. Focus on the most important and distinctive details
3. Mention relationships to other entities if evident from the excerpts
4. Be specific and evocative, suitable for D&D campaign notes

Respond with ONLY the summary text, no additional formatting.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a D&D campaign writer. Create vivid, concise summaries.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        console.error(`Failed to generate summary for ${entity.id}`);
        summaries.push({ id: entity.id, summary: entity.excerpts[0]?.substring(0, 200) || 'No summary available' });
        continue;
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content?.trim() || 'Summary generation failed';
      
      summaries.push({ id: entity.id, summary });
    }

    console.log(`Generated ${summaries.length} summaries`);

    return new Response(
      JSON.stringify({ summaries }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Regeneration error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
