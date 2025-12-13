import { GoogleGenAI } from '@google/genai';

// Types for deep research results
export interface DeepResearchResult {
    id: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    query: string;
    result?: string;
    error?: string;
    startedAt: string;
    completedAt?: string;
    metadata?: Record<string, any>;
}

export interface ResearchOptions {
    /** Custom context to provide to the research agent */
    context?: string;
    /** Maximum time to wait for research completion (ms) - default 5 minutes */
    timeout?: number;
    /** Polling interval (ms) - default 10 seconds */
    pollInterval?: number;
    /** Additional metadata to attach to the result */
    metadata?: Record<string, any>;
    /** Callback for status updates */
    onStatusUpdate?: (status: string, progress?: string) => void;
}

// In-memory store for research tasks (can be extended to use DB)
const researchTasks = new Map<string, DeepResearchResult>();

/**
 * Deep Research Module
 *
 * A flexible research function that uses Google's Deep Research API
 * to perform comprehensive research on any topic.
 *
 * Use cases:
 * - Video title and description generation
 * - Content analysis from video frames
 * - Thumbnail prompt generation
 * - Topic research for content creation
 */
export class DeepResearch {
    private client: GoogleGenAI;
    private defaultTimeout = 5 * 60 * 1000; // 5 minutes
    private defaultPollInterval = 10 * 1000; // 10 seconds

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }
        this.client = new GoogleGenAI({ apiKey });
    }

    /**
     * Start a deep research task and wait for completion
     *
     * @param query - The research query/prompt
     * @param options - Research options
     * @returns The research result
     */
    async research(query: string, options: ResearchOptions = {}): Promise<DeepResearchResult> {
        const {
            context,
            timeout = this.defaultTimeout,
            pollInterval = this.defaultPollInterval,
            metadata = {},
            onStatusUpdate,
        } = options;

        const taskId = `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startedAt = new Date().toISOString();

        // Build the full query with context
        const fullQuery = context
            ? `${context}\n\n---\n\nResearch Query:\n${query}`
            : query;

        // Initialize task record
        const task: DeepResearchResult = {
            id: taskId,
            status: 'pending',
            query: fullQuery,
            startedAt,
            metadata,
        };
        researchTasks.set(taskId, task);

        try {
            onStatusUpdate?.('starting', 'Initiating deep research...');

            // Start the research interaction using the deep-research agent
            const interaction = await this.client.interactions.create({
                agent: 'deep-research-pro-preview-12-2025',
                input: fullQuery,
                background: true,
            });

            task.status = 'in_progress';
            researchTasks.set(taskId, task);
            onStatusUpdate?.('in_progress', `Research started: ${interaction.id}`);

            console.log(`🔬 Deep research started: ${taskId}`);
            console.log(`   Interaction ID: ${interaction.id}`);

            // Poll for completion
            const startTime = Date.now();
            while (Date.now() - startTime < timeout) {
                const result = await this.client.interactions.get(interaction.id);

                if (result.status === 'completed') {
                    // Extract the text from outputs
                    let responseText = '';
                    if (result.outputs && result.outputs.length > 0) {
                        // Get the last output which should contain the final result
                        const lastOutput = result.outputs[result.outputs.length - 1];
                        if ('text' in lastOutput) {
                            responseText = lastOutput.text || '';
                        }
                    }

                    if (responseText) {
                        task.status = 'completed';
                        task.result = responseText;
                        task.completedAt = new Date().toISOString();
                        researchTasks.set(taskId, task);

                        console.log(`✅ Deep research completed: ${taskId}`);
                        onStatusUpdate?.('completed', 'Research completed successfully');

                        return task;
                    } else {
                        throw new Error('Research completed but no response text found');
                    }
                }

                if (result.status === 'failed') {
                    throw new Error('Research interaction failed');
                }

                if (result.status === 'cancelled') {
                    throw new Error('Research interaction was cancelled');
                }

                onStatusUpdate?.('in_progress', `Research in progress... (status: ${result.status})`);
                await this.sleep(pollInterval);
            }

            // Timeout reached
            throw new Error(`Research timed out after ${timeout / 1000} seconds`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            task.status = 'failed';
            task.error = errorMessage;
            task.completedAt = new Date().toISOString();
            researchTasks.set(taskId, task);

            console.error(`❌ Deep research failed: ${taskId} - ${errorMessage}`);
            onStatusUpdate?.('failed', errorMessage);

            return task;
        }
    }

    /**
     * Research for video content generation
     * Analyzes context and generates optimized title, description, and tags
     */
    async researchVideoContent(params: {
        pinterestUrl?: string;
        pinterestTitle?: string;
        pinterestDescription?: string;
        keywords?: string[];
        frameDescriptions?: string[];
        brandName?: string;
        contentThemes?: string[];
    }): Promise<{
        title: string;
        description: string;
        tags: string[];
        thumbnailPrompt?: string;
        researchInsights?: string;
    }> {
        const {
            pinterestUrl,
            pinterestTitle,
            pinterestDescription,
            keywords = [],
            frameDescriptions = [],
            brandName = '@faithandfork',
            contentThemes = ['Halal food and recipes', 'Spiritually uplifting Islamic content'],
        } = params;

        // Build context
        let context = `You are a content research specialist for the brand "${brandName}".
The brand focuses on: ${contentThemes.join(', ')}.

Available information about the video:`;

        if (pinterestUrl) {
            context += `\n- Source URL: ${pinterestUrl}`;
        }
        if (pinterestTitle) {
            context += `\n- Original title: "${pinterestTitle}"`;
        }
        if (pinterestDescription) {
            context += `\n- Original description: "${pinterestDescription}"`;
        }
        if (keywords.length > 0) {
            context += `\n- Keywords: ${keywords.join(', ')}`;
        }
        if (frameDescriptions.length > 0) {
            context += `\n- Video frame descriptions:\n${frameDescriptions.map((d, i) => `  Frame ${i + 1}: ${d}`).join('\n')}`;
        }

        const query = `Based on the video information provided, perform deep research to:

1. **Identify the primary theme** - Is this Faith/Spiritual content or Food/Recipe content?

2. **Generate an optimized YouTube title** (max 100 characters):
   - Make it engaging, emotional, and click-worthy
   - Use Hinglish/Urdu words if appropriate for the audience
   - Include the brand handle ${brandName}
   - Add 1-2 relevant hashtags

3. **Generate an SEO-optimized description** (300-500 words):
   - Start with a hook that matches the video theme
   - Include relevant keywords naturally
   - Add a compelling call-to-action
   - End with relevant hashtags

4. **Generate 10-15 relevant tags** for YouTube SEO

5. **Create a thumbnail generation prompt** - Describe the ideal thumbnail that would maximize click-through rate

6. **Provide brief research insights** - What makes this content unique and how to position it

Return your response as a JSON object with these exact keys:
{
  "theme": "faith" or "food",
  "title": "...",
  "description": "...",
  "tags": ["...", "..."],
  "thumbnailPrompt": "...",
  "researchInsights": "..."
}`;

        const result = await this.research(query, {
            context,
            metadata: { type: 'video_content', pinterestUrl },
        });

        if (result.status === 'failed' || !result.result) {
            throw new Error(result.error || 'Research failed to produce results');
        }

        // Parse the JSON response
        try {
            const jsonMatch = result.result.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in research result');
            }
            const parsed = JSON.parse(jsonMatch[0]);

            return {
                title: parsed.title || '',
                description: parsed.description || '',
                tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                thumbnailPrompt: parsed.thumbnailPrompt,
                researchInsights: parsed.researchInsights,
            };
        } catch (parseError) {
            console.error('Failed to parse research result:', parseError);
            throw new Error('Failed to parse research result as JSON');
        }
    }

    /**
     * Research based on video frame analysis
     * Takes frame descriptions and generates content insights
     */
    async researchFromFrames(params: {
        frameDescriptions: string[];
        brandContext?: string;
        targetAudience?: string;
    }): Promise<{
        contentSummary: string;
        suggestedTitle: string;
        suggestedDescription: string;
        thumbnailRecommendation: string;
        keyMoments: string[];
    }> {
        const {
            frameDescriptions,
            brandContext = 'A social media brand focused on food and faith content',
            targetAudience = 'Muslim families interested in halal food and Islamic content',
        } = params;

        const context = `Brand Context: ${brandContext}
Target Audience: ${targetAudience}

Video Frame Analysis:
${frameDescriptions.map((desc, i) => `Frame ${i + 1}: ${desc}`).join('\n')}`;

        const query = `Analyze these video frames and provide:

1. **Content Summary**: What is this video about based on the frames?

2. **Suggested Title**: An engaging title for YouTube/social media

3. **Suggested Description**: A compelling description that would resonate with the target audience

4. **Thumbnail Recommendation**: Which frame or combination would make the best thumbnail and why

5. **Key Moments**: List 3-5 key moments that should be highlighted

Return as JSON:
{
  "contentSummary": "...",
  "suggestedTitle": "...",
  "suggestedDescription": "...",
  "thumbnailRecommendation": "...",
  "keyMoments": ["...", "..."]
}`;

        const result = await this.research(query, { context });

        if (result.status === 'failed' || !result.result) {
            throw new Error(result.error || 'Frame research failed');
        }

        try {
            const jsonMatch = result.result.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in frame research result');
            }
            return JSON.parse(jsonMatch[0]);
        } catch (parseError) {
            throw new Error('Failed to parse frame research result');
        }
    }

    /**
     * Generic research for any topic
     */
    async researchTopic(topic: string, options?: {
        depth?: 'basic' | 'detailed' | 'comprehensive';
        format?: 'text' | 'json' | 'markdown';
        focusAreas?: string[];
    }): Promise<string> {
        const {
            depth = 'detailed',
            format = 'text',
            focusAreas = [],
        } = options || {};

        let query = `Research the following topic thoroughly:\n\n${topic}`;

        if (depth === 'comprehensive') {
            query += '\n\nProvide an extremely detailed analysis covering all aspects.';
        } else if (depth === 'basic') {
            query += '\n\nProvide a concise summary of the key points.';
        }

        if (focusAreas.length > 0) {
            query += `\n\nFocus particularly on: ${focusAreas.join(', ')}`;
        }

        if (format === 'json') {
            query += '\n\nReturn your response as structured JSON.';
        } else if (format === 'markdown') {
            query += '\n\nFormat your response in clean Markdown.';
        }

        const result = await this.research(query);

        if (result.status === 'failed') {
            throw new Error(result.error || 'Topic research failed');
        }

        return result.result || '';
    }

    /**
     * Get a research task by ID
     */
    getTask(taskId: string): DeepResearchResult | undefined {
        return researchTasks.get(taskId);
    }

    /**
     * Get all research tasks
     */
    getAllTasks(): DeepResearchResult[] {
        return Array.from(researchTasks.values());
    }

    /**
     * Clear completed/failed tasks older than specified age
     */
    clearOldTasks(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
        const now = Date.now();
        let cleared = 0;

        for (const [id, task] of researchTasks.entries()) {
            if (task.status === 'completed' || task.status === 'failed') {
                const taskAge = now - new Date(task.startedAt).getTime();
                if (taskAge > maxAgeMs) {
                    researchTasks.delete(id);
                    cleared++;
                }
            }
        }

        return cleared;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
let deepResearchInstance: DeepResearch | null = null;

/**
 * Get the DeepResearch singleton instance
 */
export function getDeepResearch(): DeepResearch {
    if (!deepResearchInstance) {
        deepResearchInstance = new DeepResearch();
    }
    return deepResearchInstance;
}

/**
 * Convenience function for quick research
 */
export async function quickResearch(query: string, options?: ResearchOptions): Promise<string> {
    const dr = getDeepResearch();
    const result = await dr.research(query, options);

    if (result.status === 'failed') {
        throw new Error(result.error || 'Research failed');
    }

    return result.result || '';
}

/**
 * Research video content and return optimized metadata
 */
export async function researchVideoMetadata(params: {
    pinterestUrl?: string;
    pinterestTitle?: string;
    pinterestDescription?: string;
    keywords?: string[];
    frameDescriptions?: string[];
}): Promise<{
    title: string;
    description: string;
    tags: string[];
    thumbnailPrompt?: string;
}> {
    const dr = getDeepResearch();
    return dr.researchVideoContent(params);
}
