import { GoogleGenerativeAI } from '@google/generative-ai';

interface VideoMetadata {
    title: string;
    description: string;
    tags: string[];
}

/**
 * Generate video title and description using Google Gemini AI
 * based on the Pinterest video URL
 */
export async function generateVideoMetadata(
    pinterestUrl: string,
    videoFilePath?: string
): Promise<VideoMetadata> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('GEMINI_API_KEY not found, using fallback metadata');
        return generateFallbackMetadata(pinterestUrl);
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const prompt = `You are a social media content expert for the food brand "@faith_&_fork".

I have a video downloaded from Pinterest (URL: ${pinterestUrl}).

Please generate:
1. An engaging, SEO-friendly YouTube video title (max 100 characters)
2. A compelling video description (2-3 paragraphs, max 500 characters)
3. 2-3 relevant tags and a fixed tag for \`#shorts\`

Guidelines:
- The video is likely makkah, madinah, islamic, food or cooking related content
- Target audience: muslims, indian people, quran readers, food lovers, home cooks, recipe enthusiasts
- Include "@faith_&_fork" brand mention naturally
- Make it searchable and engaging
- Use emojis sparingly for visual appeal
- Description should include a call-to-action (like, subscribe, etc.)

Format your response EXACTLY as JSON:
{
  "title": "Your title here",
  "description": "Your description here",
  "tags": ["tag1", "tag2", "tag3", ...]
}`;

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
        return generateFallbackMetadata(pinterestUrl);
    }
}

/**
 * Generate fallback metadata when AI is unavailable
 */
function generateFallbackMetadata(pinterestUrl: string): VideoMetadata {
    const timestamp = new Date().toISOString().split('T')[0];

    return {
        title: `Delicious Recipe from Pinterest - ${timestamp}`,
        description: `🍽️ Amazing food content from Pinterest!\n\nOriginal source: ${pinterestUrl}\n\nBrought to you by @faith_&_fork - Your destination for incredible recipes and cooking inspiration.\n\n👍 Like this video if you enjoyed it!\n📺 Subscribe for more delicious content!\n💬 Comment below with your thoughts!`,
        tags: [
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
        ],
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
