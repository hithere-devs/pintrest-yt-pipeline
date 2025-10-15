import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PinterestMetadata } from './pinterestDL';

interface VideoMetadata {
    title: string;
    description: string;
    tags: string[];
}

/**
 * Generate video title and description using Google Gemini AI
 * based on the Pinterest video URL and extracted metadata
 */
export async function generateVideoMetadata(
    pinterestUrl: string,
    pinterestMetadata?: PinterestMetadata,
    videoFilePath?: string
): Promise<VideoMetadata> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('GEMINI_API_KEY not found, using fallback metadata');
        return generateFallbackMetadata(pinterestUrl, pinterestMetadata);
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        // Build context from Pinterest metadata
        let contextInfo = '';
        if (pinterestMetadata?.title) {
            contextInfo += `\nOriginal Pinterest title: "${pinterestMetadata.title}"`;
        }
        if (pinterestMetadata?.description) {
            contextInfo += `\nOriginal Pinterest description: "${pinterestMetadata.description}"`;
        }
        if (pinterestMetadata?.keywords && pinterestMetadata.keywords.length > 0) {
            contextInfo += `\nPinterest keywords: ${pinterestMetadata.keywords.join(', ')}`;
        }

        const prompt = `You are a senior social media content expert and SEO specialist for the food and lifestyle brand "@faith_&_fork".

**Brand Persona:** The voice of "@faith_&_fork" is warm, inviting, and spiritually uplifting. We connect the joy of cooking and sharing food with faith, family, and community. Our tone is encouraging, authentic, and focuses on simple, wholesome recipes, especially those with cultural or religious significance (e.g., Halal, Ramadan, Eid).

**Objective:**
Your task is to take the provided metadata from a Pinterest video and generate a complete, SEO-optimized YouTube Shorts or video post. The content should be highly engaging and searchable for our target audience.

**Input Data:**
You will be given these two variables:
1.  **pinterestUrl**: \`${pinterestUrl}\`
2.  **contextInfo**:
    \`\`\`json
    ${contextInfo}
    \`\`\`
    *(Note: The \`contextInfo\` is the primary source of information for you to use.)*

**Your Task:**
Based on the \`contextInfo\`, generate the following three components:

1.  **Engaging YouTube Video Title:**
    *   **Length:** Maximum 100 characters.
    *   **Branding:** Subtly include the brand name, like \`| @faith_&_fork\`.
    *   **Hashtags:** MUST end with 1-2 relevant, high-level hashtags (e.g., #shorts #ramadan).
    *   **Tone & Style (Very Important):**
        *   **Emotional & Catchy:** The title must be emotionally resonant. Instead of just describing the recipe, evoke a feeling.
        *   **Hinglish & Urdu:** Use a natural mix of Hindi and English (Hinglish). Incorporate soulful Urdu words where appropriate to add flavor (e.g., "Lazeez," "Zaykedar," "Dil Khush," "Shahi").
        *   **Focus on Appeal:** Highlight what makes the dish special (e.g., "5-Minute Recipe," "Family Favorite," "Secret Ingredient").
        *   **AVOID:** Do not use dates or overly formal language.
    *   **Examples:**
        *   **Instead of:** "Easy Chicken Biryani Recipe"
        *   **Use:** "Dil Khush Kar Dene Wali Chicken Biryani! 😋 | @faith_&_fork #biryani"
        *   **Instead of:** "Making Sheer Khurma for Eid 2025"
        *   **Use:** "Eid ki Ronak badha dega ye Lazeez Sheer Khurma! ✨ | @faith_&_fork #eidrecipes"

2.  **Compelling Video Description:**
    *   **Structure:**
        *   **Paragraph 1 (Hook):** Start with an engaging sentence that grabs the viewer's attention and describes the video's content.
        *   **Paragraph 2 (Details & Connection):** Provide more details about the recipe. Naturally mention the "@faith_&_fork" brand, connecting it to our values (e.g., "At @faith_&_fork, we believe every meal is a blessing...").
        *   **Call-to-Action (CTA):** After the main description, add a clear CTA on its own line. (e.g., "Don't forget to like, subscribe, and share for more wholesome recipes!").
        *   **Hashtag Block:** Leave one blank line after the CTA, then list ALL the generated hashtags.
    *   **Tone:** Use the brand persona—warm and encouraging. Use emojis sparingly.

3.  **Relevant Tags/Hashtags:**
    *   **Quantity:** Generate a list of 8-10 highly relevant tags.
    *   **Mix:** Include broad, specific, and community-focused tags.
        *   **Broad:** e.g., \`food\`, \`recipe\`, \`cooking\`
        *   **Specific:** e.g., \`chickencurry\`, \`ramadanrecipes\`, \`iftardrink\`
        *   **Community/Brand:** e.g., \`halalfood\`, \`muslimfoodies\`, \`faithandfork\`

**Target Audience:**
*   Muslims seeking Halal recipes and spiritually relevant content.
*   Food lovers and home cooks interested in Indian, Pakistani, and Middle Eastern cuisine.
*   Recipe enthusiasts looking for clear, easy-to-follow cooking instructions.

**Final Output Format:**
Your response MUST be in a single, clean JSON block with no extra text before or after. Use the exact keys "title", "description", and "tags".

{
  "title": "Aapka Dil Jeet lega ye Shahi Korma! ✨ | @faith_&_fork #shorts",
  "description": "Your 2-3 paragraph description here. Naturally include @faith_&_fork.\\n\\nDon't forget to like, subscribe, and share!\\n\\n#korma #eidrecipes #halalfood #indianfood #pakistanifood #dinnerrecipe #muslimfoodies #easyrecipe #faithandfork",
  "tags": ["shahi korma", "eid recipes", "halal food", "indian food", "pakistani food", "dinner recipe", "muslim foodies", "easy recipe"]
}
`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn('Failed to parse AI response, using fallback');
            return generateFallbackMetadata(pinterestUrl);
        }

        const metadata = JSON.parse(jsonMatch[0]) as VideoMetadata;

        // Validate and sanitize
        if (!metadata.title || !metadata.description || !Array.isArray(metadata.tags)) {
            console.warn('Invalid AI response structure, using fallback');
            return generateFallbackMetadata(pinterestUrl);
        }

        // Ensure title is within YouTube's limit
        if (metadata.title.length > 100) {
            metadata.title = metadata.title.substring(0, 97) + '...';
        }

        // Ensure description is reasonable length
        if (metadata.description.length > 5000) {
            metadata.description = metadata.description.substring(0, 4997) + '...';
        }

        // Limit tags to 15 (YouTube limit is 500 characters total for tags)
        metadata.tags = metadata.tags.slice(0, 15);

        console.log('✨ AI-generated metadata:');
        console.log(`   Title: ${metadata.title}`);
        console.log(`   Tags: ${metadata.tags.join(', ')}`);

        return metadata;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`AI generation failed: ${message}`);
        return generateFallbackMetadata(pinterestUrl, pinterestMetadata);
    }
}

/**
 * Generate fallback metadata when AI is unavailable
 * Uses Pinterest metadata if available for better context
 */
function generateFallbackMetadata(
    pinterestUrl: string,
    pinterestMetadata?: PinterestMetadata
): VideoMetadata {
    const timestamp = new Date().toISOString().split('T')[0];

    // Use Pinterest title if available, otherwise use generic title
    let title = `Delicious Recipe from Pinterest #food #cooking`;
    if (pinterestMetadata?.title) {
        // Clean up Pinterest title (remove "- Pinterest" suffix if present)
        const cleanTitle = pinterestMetadata.title.replace(/\s*-\s*Pinterest.*$/i, '').trim();
        // Add hashtags at the end
        const titleWithHashtags = `${cleanTitle} #recipe #food`;
        if (titleWithHashtags.length <= 100) {
            title = titleWithHashtags;
        } else if (cleanTitle.length <= 85) {
            // If clean title fits with hashtags
            title = `${cleanTitle} #food #recipe`;
        } else {
            // Truncate to fit hashtags
            title = `${cleanTitle.substring(0, 85)}... #food`;
        }
    }

    // Use Pinterest description if available
    let description = `🍽️ Amazing food content from Pinterest!\n\nOriginal source: ${pinterestUrl}\n\nBrought to you by @faith_&_fork - Your destination for incredible recipes and cooking inspiration.\n\n👍 Like this video if you enjoyed it!\n📺 Subscribe for more delicious content!\n💬 Comment below with your thoughts!\n\n#food #cooking #recipe #pinterest #delicious #yummy #homecooking #foodie #faith_and_fork #tasty`;
    if (pinterestMetadata?.description) {
        description = `${pinterestMetadata.description}\n\nOriginal source: ${pinterestUrl}\n\n@faith_&_fork\n\n👍 Like • 📺 Subscribe • 💬 Comment!\n\n#food #cooking #recipe #pinterest #delicious #yummy #homecooking #foodie #faith_and_fork #tasty`;
    }

    // Combine Pinterest keywords with default tags
    let tags = [
        'faith_and_fork',
        'pinterest',
        'food',
        'cooking',
        'recipe',
        'foodie',
        'homecooking',
        'delicious',
        'yummy',
        'tasty',
    ];

    if (pinterestMetadata?.keywords && pinterestMetadata.keywords.length > 0) {
        // Add Pinterest keywords, removing duplicates
        const lowerTags = tags.map(t => t.toLowerCase());
        const newKeywords = pinterestMetadata.keywords
            .filter(k => !lowerTags.includes(k.toLowerCase()))
            .slice(0, 5); // Add up to 5 new keywords
        tags = [...tags, ...newKeywords];
    }

    return {
        title,
        description,
        tags,
    };
}

/**
 * Test the AI generation with a sample URL
 */
export async function testAIGeneration(): Promise<void> {
    console.log('Testing AI generation...');
    const metadata = await generateVideoMetadata('https://pin.it/test123');
    console.log('\nGenerated metadata:');
    console.log(JSON.stringify(metadata, null, 2));
}
