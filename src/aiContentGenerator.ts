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

        const prompt = `You are a senior social media content expert and SEO specialist for the brand "@faith_&_fork". Our brand has two main content pillars: 1) Halal food and recipes, and 2) Spiritually uplifting Islamic content. Your primary job is to correctly identify the video's theme and generate perfectly tailored content.

**Input Data:**
You will be given these two variables:
1.  **pinterestUrl**: \`${pinterestUrl}\`
2.  **contextInfo**:
    \`\`\`json
    ${contextInfo}
    \`\`\`

**Your Task (A 2-Step Process):**

---

**STEP 1: Identify the Video's Primary Theme (CRITICAL)**

First, analyze the \`contextInfo\` (especially the "originalTitle", "originalDescription", and "detectedKeywords"). You MUST decide if the video's main theme is **"Faith/Spiritual"** or **"Food/Recipe"**.

*   **"Faith/Spiritual" Theme:** Keywords like Makkah, Madinah, Allah, Quran, Islamic, Nasheed, Prayer, Jummah, Ramadan, Hajj, spiritual, faith.
*   **"Food/Recipe" Theme:** Keywords like recipe, cooking, food, kitchen, biryani, dessert, halal food, iftar recipe, ingredients.

**This is the most important step. Your entire output depends on correctly identifying the theme. Do not mix them.**

---

**STEP 2: Generate Content Based on the Identified Theme**

Follow the instructions for the theme you identified in Step 1.

---

**A) IF THE THEME IS "Faith/Spiritual":**

*   **Persona:** Your tone must be reverent, peaceful, and inspirational.
*   **1. Video Title (Max 100 chars):**
    *   **Content:** Create a soul-touching and emotional title. Use words like "Sukun," "Peaceful," "Jummah Mubarak," "Subhan'Allah," "Masha'Allah." The title should reflect the spiritual feeling of the video.
    *   **Branding:** Include \`| @faith_&_fork\`.
    *   **Hashtags:** End with 1-2 relevant hashtags like \`#islamic\`, \`#makkah\`, \`#shorts\`.
    *   **Example:** "Sukun-e-Qalb ❤️ The Peaceful Azan from Madinah | @faith_&_fork #madinah #islam"

*   **2. Video Description:**
    *   **Content:** Write 1-2 short, reflective paragraphs about the beauty of Islam, the scene in the video, or a gentle reminder.
    *   **Brand Mention:** Connect the brand to the theme spiritually, e.g., "At @faith_&_fork, we pray these moments bring peace to your heart."
    *   **CTA:** Use a spiritual call-to-action, e.g., "Share this beautiful reminder with your loved ones. May Allah bless you."
    *   **Hashtags:** List ALL generated tags at the bottom.

*   **3. Tags (8-10):**
    *   **Content:** MUST be strictly related to Islam.
    *   **Examples:** \`islamicstatus\`, \`makkah\`, \`madinah\`, \`quran\`, \`allah\`, \`muslim\`, \`deen\`, \`spiritual\`, \`jummahmubarak\`, \`faithandfork\`.

---

**B) IF THE THEME IS "Food/Recipe":**

*   **Persona:** Your tone must be warm, inviting, and focused on the joy of cooking.
*   **1. Video Title (Max 100 chars):**
    *   **Content:** Create a catchy, emotional, Hinglish/Urdu title. Use words like "Lazeez," "Zaykedar," "Dil Khush." It should make the food sound irresistible. AVOID DATES.
    *   **Branding:** Include \`| @faith_&_fork\`.
    *   **Hashtags:** End with 1-2 relevant hashtags like \`#recipe\`, \`#halalfood\`, \`#shorts\`.
    *   **Example:** "Dil Khush Kar Dene Wali Chicken Biryani! 😋 | @faith_&_fork #biryani #recipe"

*   **2. Video Description:**
    *   **Content:** Write 2 engaging paragraphs describing the dish and why it's special.
    *   **Brand Mention:** Connect the brand to the food, e.g., "At @faith_&_fork, we believe that good food brings families together."
    *   **CTA:** Use a standard call-to-action, e.g., "Don't forget to like, subscribe, and share for more delicious recipes!"
    *   **Hashtags:** List ALL generated tags at the bottom.

*   **3. Tags (8-10):**
    *   **Content:** MUST be strictly related to food and cooking.
    *   **Examples:** \`indianfood\`, \`pakistanifood\`, \`halalrecipe\`, \`dinnerideas\`, \`iftarrecipes\`, \`easycooking\`, \`muslimfoodies\`, \`faithandfork\`.

---

**Final Output Format:**
Your response MUST be in a single, clean JSON block with no extra text before or after. Use the exact keys "title", "description", and "tags".

{
  "title": "Your generated title based on the correct theme",
  "description": "Your generated description based on the correct theme.\\n\\nYour generated CTA based on the correct theme.\\n\\n#hashtags #based #on #the #correct #theme",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
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
