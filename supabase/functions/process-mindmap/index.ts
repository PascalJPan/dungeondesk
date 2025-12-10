import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EntityResult {
  type: string;
  label: string;
  summary: string;
  chunkIndices: number[];
}

interface RelationshipResult {
  sourceType: string;
  sourceIndex: number;
  targetType: string;
  targetIndex: number;
  description: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chunks, extractionOptions } = await req.json();
    
    if (!chunks || !Array.isArray(chunks) || chunks.length < 3) {
      return new Response(
        JSON.stringify({ error: 'At least 3 text chunks are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entityTypes = extractionOptions?.entityTypes || ['location', 'happening', 'character', 'monster'];
    const clusterRange = extractionOptions?.clusterRange || { min: 3, max: 15 };

    console.log(`Processing ${chunks.length} chunks for entity types: ${entityTypes.join(', ')}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const processedChunks = chunks.slice(0, 100);
    
    const numberedChunks = processedChunks
      .map((chunk: string, i: number) => `[${i}] ${chunk.substring(0, 400)}${chunk.length > 400 ? '...' : ''}`)
      .join('\n\n');

    // Step 1: Extract entities by type
    console.log('Extracting campaign entities...');
    
    const entityTypeDescriptions = {
      location: 'Places, regions, cities, dungeons, buildings, landmarks',
      happening: 'Events, encounters, plot points, quests, scenes',
      character: 'NPCs, allies, villains, named individuals',
      monster: 'Creatures, beasts, enemies, bosses',
      item: 'Magical items, artifacts, weapons, treasures',
    };

    const typeInstructions = entityTypes
      .map((t: string) => `- ${t}: ${entityTypeDescriptions[t as keyof typeof entityTypeDescriptions] || t}`)
      .join('\n');

    const extractionPrompt = `You are analyzing D&D campaign notes. Extract all mentioned entities from the text chunks below.

ENTITY TYPES TO EXTRACT:
${typeInstructions}

TEXT CHUNKS:
${numberedChunks}

RULES:
1. Extract ${clusterRange.min}-${clusterRange.max} entities PER TYPE that is mentioned in the text
2. Each entity can reference MULTIPLE chunk indices if it appears in multiple places
3. Summaries should be 2-4 sentences describing the entity in detail
4. Labels should be the entity's name or a short descriptive title (3-6 words max)
5. Write summaries as direct statements, never starting with "This is..." or "This entity..."

Respond with ONLY valid JSON in this exact format:
{
  "entities": [
    {
      "type": "location",
      "label": "The Sunken Temple",
      "summary": "Ancient temple dedicated to a forgotten sea god, now partially submerged beneath the Mistwood Swamp. Contains valuable artifacts but is guarded by aquatic undead. The central altar still radiates divine energy.",
      "chunkIndices": [0, 3, 12]
    },
    {
      "type": "character", 
      "label": "Baron Valdris",
      "summary": "Cursed nobleman seeking the Phoenix Flame to break his pact with a demon. Commands a small army of mercenaries. Known for his silver tongue and ruthless ambition.",
      "chunkIndices": [2, 5, 8]
    }
  ]
}`;

    const entityResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a D&D campaign analyzer. Extract entities precisely and respond only with valid JSON.' },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!entityResponse.ok) {
      const errorText = await entityResponse.text();
      console.error('Entity extraction API error:', entityResponse.status, errorText);
      
      if (entityResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (entityResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${entityResponse.status}`);
    }

    const entityData = await entityResponse.json();
    const entityContent = entityData.choices?.[0]?.message?.content || '';
    
    console.log('Raw entity response:', entityContent.substring(0, 500));

    let entities: EntityResult[];
    try {
      const jsonMatch = entityContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                        entityContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : entityContent;
      const parsed = JSON.parse(jsonStr.trim());
      entities = parsed.entities || [];
      
      if (!Array.isArray(entities)) {
        throw new Error('Invalid entities format');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback: create basic entities
      entities = entityTypes.flatMap((type: string, typeIdx: number) => [{
        type,
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${typeIdx + 1}`,
        summary: `Extracted ${type} from campaign notes`,
        chunkIndices: [typeIdx % processedChunks.length],
      }]);
    }

    // Filter to only requested types
    entities = entities.filter(e => entityTypes.includes(e.type));

    console.log(`Extracted ${entities.length} entities`);

    // Step 2: Generate relationships between entities
    console.log('Generating relationships...');

    const entityList = entities.map((e, i) => `[${e.type}:${i}] ${e.label}`).join('\n');

    const relationshipPrompt = `Given these D&D campaign entities, identify the relationships between them.

ENTITIES:
${entityList}

ENTITY SUMMARIES:
${entities.map((e, i) => `[${e.type}:${i}] ${e.label}: ${e.summary}`).join('\n\n')}

Generate relationships following these rules:
1. Locations can contain happenings, characters, monsters, and items
2. Happenings involve characters, monsters, and can occur at locations
3. Characters and monsters can appear at locations and in happenings
4. Items can be found at locations, owned by characters, or dropped by monsters
5. Only create relationships that make logical sense based on the summaries
6. Each relationship needs a brief description (3-8 words)

Respond with ONLY valid JSON:
{
  "relationships": [
    {
      "sourceType": "location",
      "sourceIndex": 0,
      "targetType": "happening",
      "targetIndex": 1,
      "description": "takes place at"
    },
    {
      "sourceType": "monster",
      "sourceIndex": 0,
      "targetType": "location", 
      "targetIndex": 0,
      "description": "guards"
    }
  ]
}`;

    const relationshipResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a D&D campaign relationship analyzer. Identify connections between entities and respond only with valid JSON.' },
          { role: 'user', content: relationshipPrompt }
        ],
        temperature: 0.3,
      }),
    });

    let relationships: RelationshipResult[] = [];

    if (relationshipResponse.ok) {
      const relData = await relationshipResponse.json();
      const relContent = relData.choices?.[0]?.message?.content || '';
      
      console.log('Raw relationship response:', relContent.substring(0, 500));

      try {
        const jsonMatch = relContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                          relContent.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : relContent;
        const parsed = JSON.parse(jsonStr.trim());
        relationships = parsed.relationships || [];
      } catch (e) {
        console.error('Relationship parse error:', e);
      }
    }

    // Validate relationships
    relationships = relationships.filter(rel => {
      const sourceExists = entities.some((e, i) => e.type === rel.sourceType && i === rel.sourceIndex);
      const targetExists = entities.some((e, i) => e.type === rel.targetType && i === rel.targetIndex);
      return sourceExists && targetExists;
    });

    console.log(`Created ${relationships.length} relationships`);

    const result = {
      entities,
      relationships,
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
