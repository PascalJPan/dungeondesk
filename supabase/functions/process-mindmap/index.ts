import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BaseEntity {
  id: string;
  type: string;
  name: string;
  shortDescription: string;
  longDescription: string;
}

interface ExtractedEntity extends BaseEntity {
  [key: string]: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, extractionOptions } = await req.json();
    
    if (!text || typeof text !== 'string' || text.length < 50) {
      return new Response(
        JSON.stringify({ error: 'Text must be at least 50 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entityTypes = extractionOptions?.entityTypes || ['location', 'happening', 'character', 'monster', 'item'];

    console.log(`Processing text (${text.length} chars) for entity types: ${entityTypes.join(', ')}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Truncate text if too long
    const processedText = text.length > 50000 ? text.substring(0, 50000) : text;

    // Entity field schemas for extraction
    const entitySchemas: Record<string, string[]> = {
      location: ['shortDescription', 'longDescription', 'background'],
      happening: ['shortDescription', 'longDescription', 'potentialStarts', 'potentialOutcomes'],
      character: ['shortDescription', 'longDescription', 'background', 'motivationsGoals', 'personality'],
      monster: ['shortDescription', 'longDescription', 'abilities', 'behavior'],
      item: ['shortDescription', 'longDescription', 'properties', 'history'],
    };

    const entityDescriptions: Record<string, string> = {
      location: 'Places, regions, cities, dungeons, buildings, landmarks',
      happening: 'Events, encounters, plot points, quests, scenes',
      character: 'NPCs, allies, villains, named individuals (not monsters)',
      monster: 'Creatures, beasts, enemies, bosses that can be fought',
      item: 'Magical items, artifacts, weapons, treasures, special objects',
    };

    const relationFields: Record<string, string[]> = {
      location: ['associatedCharacters', 'associatedMonsters', 'associatedHappenings', 'associatedItems'],
      happening: ['associatedLocations', 'associatedCharacters', 'associatedMonsters', 'associatedItems'],
      character: ['associatedLocations', 'associatedHappenings', 'associatedItems'],
      monster: ['associatedLocations', 'associatedHappenings', 'associatedItems'],
      item: ['associatedLocations', 'associatedCharacters', 'associatedHappenings'],
    };

    // Build the extraction prompt
    const typeInstructions = entityTypes.map((type: string) => {
      const fields = entitySchemas[type] || [];
      const relations = relationFields[type] || [];
      return `
### ${type.charAt(0).toUpperCase() + type.slice(1)}s
Description: ${entityDescriptions[type] || type}
Fields to extract:
- name: The entity's name (required)
- shortDescription: 2-3 sentence summary (required)
${fields.filter(f => f !== 'shortDescription').map(f => `- ${f}: ${getFieldDescription(f)}`).join('\n')}
Relations (use entity IDs):
${relations.map(r => `- ${r}: Array of IDs of related entities`).join('\n')}`;
    }).join('\n\n');

    const extractionPrompt = `You are analyzing D&D campaign notes. Extract ALL entities mentioned in the text.

TEXT TO ANALYZE:
${processedText}

ENTITY TYPES TO EXTRACT:
${typeInstructions}

IMPORTANT RULES:
1. Extract EVERY entity mentioned, even if information is incomplete
2. Use unique IDs for each entity in format: "{type}-{number}" (e.g., "location-1", "character-2")
3. shortDescription should be exactly 2-3 sentences - no more, no less
4. Leave fields empty ("") if information is not provided in the text
5. For relations, ONLY include entity IDs that you are extracting
6. Do NOT invent information - only extract what's in the text
7. Be precise with relationships - only create them when clearly implied

Respond with ONLY valid JSON in this exact format:
{
  "entities": [
    {
      "id": "location-1",
      "type": "location",
      "name": "The Sunken Temple",
      "shortDescription": "An ancient temple dedicated to a forgotten sea god. Now partially submerged beneath the Mistwood Swamp. Contains valuable artifacts guarded by aquatic undead.",
      "longDescription": "",
      "background": "",
      "associatedCharacters": ["character-1"],
      "associatedMonsters": ["monster-1"],
      "associatedHappenings": [],
      "associatedItems": ["item-1"]
    }
  ]
}`;

    console.log('Sending extraction request to AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are a D&D campaign analyzer. Extract entities precisely from campaign notes. Respond only with valid JSON. Never invent information not present in the source text.' 
          },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log('Raw AI response:', content.substring(0, 1000));

    let entities: ExtractedEntity[];
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                        content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      const parsed = JSON.parse(jsonStr.trim());
      entities = parsed.entities || [];
      
      if (!Array.isArray(entities)) {
        throw new Error('Invalid entities format');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content that failed to parse:', content);
      
      // Return empty result rather than fake data
      entities = [];
    }

    // Filter to only requested types and validate
    entities = entities.filter(e => entityTypes.includes(e.type));

    // Ensure all entities have required fields
    entities = entities.map((entity, idx) => {
      const type = entity.type as string;
      const fields = entitySchemas[type] || [];
      const relations = relationFields[type] || [];
      
      const cleaned: ExtractedEntity = {
        id: entity.id || `${type}-${idx + 1}`,
        type: entity.type,
        name: entity.name || `Unknown ${type}`,
        shortDescription: entity.shortDescription || '',
        longDescription: entity.longDescription || '',
      };

      // Add type-specific fields
      fields.forEach(field => {
        if (field !== 'shortDescription' && field !== 'longDescription') {
          cleaned[field] = entity[field] || '';
        }
      });

      // Add relation fields
      relations.forEach(rel => {
        cleaned[rel] = Array.isArray(entity[rel]) ? entity[rel] : [];
      });

      return cleaned;
    });

    // Validate relations - remove references to non-existent entities
    const entityIds = new Set(entities.map(e => e.id));
    entities = entities.map(entity => {
      const type = entity.type as string;
      const relations = relationFields[type] || [];
      
      relations.forEach(rel => {
        if (Array.isArray(entity[rel])) {
          entity[rel] = entity[rel].filter((id: string) => entityIds.has(id));
        }
      });
      
      return entity;
    });

    console.log(`Extracted ${entities.length} entities`);

    return new Response(
      JSON.stringify({ entities }),
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

function getFieldDescription(field: string): string {
  const descriptions: Record<string, string> = {
    longDescription: 'Detailed description if available',
    background: 'History and background information',
    potentialStarts: 'How this event might begin',
    potentialOutcomes: 'Possible results of this event',
    motivationsGoals: 'What drives this character',
    personality: 'Character traits and demeanor',
    abilities: 'Special powers or combat capabilities',
    behavior: 'How this creature acts',
    properties: 'Magical or special properties',
    history: 'Origin and previous owners',
  };
  return descriptions[field] || field;
}
