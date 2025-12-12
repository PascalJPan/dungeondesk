import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttributeDef {
  key: string;
  label: string;
}

interface EntityTypeDef {
  key: string;
  label: string;
  color: string;
  attributes: AttributeDef[];
  extractionPrompt?: string;
}

interface ExtractedEntity {
  id: string;
  type: string;
  name: string;
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

    const entityTypes: EntityTypeDef[] = extractionOptions?.entityTypes || [];
    
    if (entityTypes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one entity type must be configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing text (${text.length} chars) for entity types: ${entityTypes.map(t => t.key).join(', ')}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Truncate text if too long
    const processedText = text.length > 50000 ? text.substring(0, 50000) : text;

    // Build the extraction prompt based on configured entity types
    const typeInstructions = entityTypes.map((typeDef) => {
      const attributeList = typeDef.attributes
        .map(attr => `- ${attr.key}: ${attr.label}`)
        .join('\n');
      
      const promptGuidance = typeDef.extractionPrompt 
        ? `\nEXTRACTION GUIDANCE: ${typeDef.extractionPrompt}`
        : '';
      
      return `
### ${typeDef.label}
Entity type key: "${typeDef.key}"${promptGuidance}
Attributes to extract:
- name: The entity's name (required)
${attributeList}`;
    }).join('\n\n');

    const extractionPrompt = `You are analyzing D&D campaign notes. Extract ALL entities mentioned in the text.

TEXT TO ANALYZE:
${processedText}

ENTITY TYPES TO EXTRACT:
${typeInstructions}

IMPORTANT RULES:
1. Extract EVERY entity mentioned, even if information is incomplete
2. Use unique IDs for each entity in format: "{type}-{number}" (e.g., "location-1", "character-2")
3. Leave fields empty ("") if information is not provided in the text
4. Do NOT invent information - only extract what's in the text
5. Each attribute value should be text (string)
6. For combat stats (healthPoints, armorClass, speed, speedWater), extract as strings (e.g., "45", "16", "30ft", "40ft")
7. For attacks, format as multi-line text like:
   "Attack Name
   - +X to hit
   - XdX + X damage type"

Respond with ONLY valid JSON in this exact format:
{
  "entities": [
    {
      "id": "location-1",
      "type": "location",
      "name": "The Sunken Temple",
      "shortDescription": "An ancient temple dedicated to a forgotten sea god.",
      "longDescription": "",
      "background": ""
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
      entities = [];
    }

    // Build a map of valid entity type keys
    const validTypeKeys = new Set(entityTypes.map(t => t.key));
    
    // Filter to only valid types and ensure all attributes exist
    entities = entities
      .filter(e => validTypeKeys.has(e.type))
      .map((entity, idx) => {
        const typeDef = entityTypes.find(t => t.key === entity.type);
        if (!typeDef) return null;
        
        const cleaned: ExtractedEntity = {
          id: entity.id || `${entity.type}-${idx + 1}`,
          type: entity.type,
          name: entity.name || `Unknown ${typeDef.label}`,
        };

        // Add all configured attributes
        typeDef.attributes.forEach(attr => {
          cleaned[attr.key] = entity[attr.key] || '';
        });

        return cleaned;
      })
      .filter(Boolean) as ExtractedEntity[];

    console.log(`Extracted ${entities.length} entities, now building associations...`);

    // Second pass: Build bidirectional associations
    const entityNames = new Set(entities.map(e => e.name.toLowerCase()));
    const entityById = new Map(entities.map(e => [e.id, e]));
    const entityByName = new Map(entities.map(e => [e.name.toLowerCase(), e]));

    // For each entity, scan all text fields for mentions of other entities
    entities.forEach(entity => {
      const mentionedEntities: string[] = [];
      
      // Get all text content from this entity
      const textContent = Object.entries(entity)
        .filter(([key]) => !['id', 'type', 'name', 'associatedEntities'].includes(key))
        .map(([, value]) => String(value || ''))
        .join(' ')
        .toLowerCase();
      
      // Check for mentions of other entities
      entities.forEach(otherEntity => {
        if (otherEntity.id === entity.id) return;
        
        const otherName = otherEntity.name.toLowerCase();
        if (textContent.includes(otherName)) {
          mentionedEntities.push(otherEntity.name);
        }
      });
      
      // Merge with any AI-extracted associations (handle both array and string formats)
      let existingAssocs: string[] = [];
      if (entity.associatedEntities) {
        if (Array.isArray(entity.associatedEntities)) {
          existingAssocs = entity.associatedEntities.map((s: any) => String(s).trim()).filter(Boolean);
        } else if (typeof entity.associatedEntities === 'string') {
          existingAssocs = entity.associatedEntities.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      
      const allAssocs = [...new Set([...existingAssocs, ...mentionedEntities])];
      entity.associatedEntities = allAssocs.join(', ');
    });

    // Make associations bidirectional
    entities.forEach(entity => {
      let assocs: string[] = [];
      if (entity.associatedEntities) {
        if (Array.isArray(entity.associatedEntities)) {
          assocs = entity.associatedEntities.map((s: any) => String(s).trim()).filter(Boolean);
        } else if (typeof entity.associatedEntities === 'string') {
          assocs = entity.associatedEntities.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }
      
      assocs.forEach((assocName: string) => {
        const linkedEntity = entityByName.get(assocName.toLowerCase());
        if (linkedEntity && linkedEntity.id !== entity.id) {
          let linkedAssocs: string[] = [];
          if (linkedEntity.associatedEntities) {
            if (Array.isArray(linkedEntity.associatedEntities)) {
              linkedAssocs = linkedEntity.associatedEntities.map((s: any) => String(s).trim()).filter(Boolean);
            } else if (typeof linkedEntity.associatedEntities === 'string') {
              linkedAssocs = linkedEntity.associatedEntities.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
          
          if (!linkedAssocs.some((a: string) => a.toLowerCase() === entity.name.toLowerCase())) {
            linkedAssocs.push(entity.name);
            linkedEntity.associatedEntities = linkedAssocs.join(', ');
          }
        }
      });
    });

    console.log(`Final entity count: ${entities.length}`);

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
