import { uploadToS3 } from './gcsClient';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Voice IDs - These are example IDs, replace with actual ElevenLabs voice IDs
export const VOICE_PROFILES: Record<string, { elevenLabsId: string; name: string; description: string }> = {
    stewie: {
        elevenLabsId: 'pNInz6obpgDQGcFmaJgB', // Adam - replace with actual voice clone
        name: 'Stewie Griffin',
        description: 'Intelligent, sarcastic baby voice',
    },
    peter: {
        elevenLabsId: 'yoZ06aMxZJJ28mfd3POQ', // Sam - replace with actual voice clone
        name: 'Peter Griffin',
        description: 'Lovable oaf with distinctive laugh',
    },
    narrator: {
        elevenLabsId: '21m00Tcm4TlvDq8ikWAM', // Rachel - professional
        name: 'Deep Narrator',
        description: 'Professional documentary style',
    },
    energetic: {
        elevenLabsId: 'EXAVITQu4vr4xnSDxMaL', // Bella - energetic
        name: 'Energetic Host',
        description: 'High energy, enthusiastic',
    },
    calm: {
        elevenLabsId: 'MF3mGyEYCl7XYWbV9V6O', // Elli - calm
        name: 'Calm Storyteller',
        description: 'Soothing, relaxed narration',
    },
};

export interface TTSOptions {
    stability?: number; // 0-1, default 0.5
    similarityBoost?: number; // 0-1, default 0.75
    style?: number; // 0-1, default 0
    useSpeakerBoost?: boolean;
}

export interface TTSResult {
    audioBuffer: Buffer;
    s3Key?: string;
    s3Url?: string;
    localPath?: string;
    duration?: number;
    wordTimings?: WordTiming[];
}

export interface WordTiming {
    word: string;
    start: number;  // start time in seconds
    end: number;    // end time in seconds
}

export interface VoiceInfo {
    id: string;
    name: string;
    description: string;
    previewUrl?: string;
    category?: string;
}

/**
 * Get available voices from ElevenLabs API
 */
export async function getAvailableVoices(): Promise<VoiceInfo[]> {
    if (!ELEVENLABS_API_KEY) {
        // Return default voices if no API key
        return Object.entries(VOICE_PROFILES).map(([id, profile]) => ({
            id,
            name: profile.name,
            description: profile.description,
        }));
    }

    try {
        const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
            },
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const data = await response.json();
        return data.voices.map((voice: any) => ({
            id: voice.voice_id,
            name: voice.name,
            description: voice.description || voice.labels?.description || '',
            previewUrl: voice.preview_url,
            category: voice.category,
        }));
    } catch (error) {
        console.error('Error fetching voices:', error);
        // Fallback to default voices
        return Object.entries(VOICE_PROFILES).map(([id, profile]) => ({
            id,
            name: profile.name,
            description: profile.description,
        }));
    }
}

/**
 * Generate speech from text using ElevenLabs API
 */
export async function generateSpeech(
    text: string,
    voiceId: string,
    options: TTSOptions = {}
): Promise<Buffer> {
    if (!ELEVENLABS_API_KEY) {
        throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Get the actual ElevenLabs voice ID
    const voiceProfile = VOICE_PROFILES[voiceId];
    const actualVoiceId = voiceProfile?.elevenLabsId || voiceId;

    const {
        stability = 0.5,
        similarityBoost = 0.75,
        style = 0,
        useSpeakerBoost = true,
    } = options;

    const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${actualVoiceId}`,
        {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability,
                    similarity_boost: similarityBoost,
                    style,
                    use_speaker_boost: useSpeakerBoost,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Generate speech with word-level timestamps using ElevenLabs API
 */
export async function generateSpeechWithTimestamps(
    text: string,
    voiceId: string,
    options: TTSOptions = {}
): Promise<{ audioBuffer: Buffer; wordTimings: WordTiming[] }> {
    if (!ELEVENLABS_API_KEY) {
        throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    // Get the actual ElevenLabs voice ID
    const voiceProfile = VOICE_PROFILES[voiceId];
    const actualVoiceId = voiceProfile?.elevenLabsId || voiceId;

    const {
        stability = 0.5,
        similarityBoost = 0.75,
        style = 0,
        useSpeakerBoost = true,
    } = options;

    const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${actualVoiceId}/with-timestamps`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability,
                    similarity_boost: similarityBoost,
                    style,
                    use_speaker_boost: useSpeakerBoost,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Decode base64 audio
    const audioBuffer = Buffer.from(result.audio_base64, 'base64');

    // Extract word timings from alignment
    const wordTimings: WordTiming[] = [];
    if (result.alignment && result.alignment.characters) {
        const chars = result.alignment.characters;
        const charStarts = result.alignment.character_start_times_seconds;
        const charEnds = result.alignment.character_end_times_seconds;

        // Group characters into words
        let currentWord = '';
        let wordStart = 0;
        let wordEnd = 0;

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];

            if (char === ' ' || i === chars.length - 1) {
                // End of word
                if (i === chars.length - 1 && char !== ' ') {
                    currentWord += char;
                    wordEnd = charEnds[i];
                }

                if (currentWord.trim()) {
                    wordTimings.push({
                        word: currentWord.trim(),
                        start: wordStart,
                        end: wordEnd,
                    });
                }

                currentWord = '';
                if (i < chars.length - 1) {
                    wordStart = charStarts[i + 1];
                }
            } else {
                if (currentWord === '') {
                    wordStart = charStarts[i];
                }
                currentWord += char;
                wordEnd = charEnds[i];
            }
        }
    }

    return { audioBuffer, wordTimings };
}

/**
 * Generate speech and save to S3 with word-level timestamps
 */
export async function generateSpeechToS3(
    text: string,
    voiceId: string,
    projectId: string,
    options: TTSOptions = {}
): Promise<TTSResult> {
    // Use timestamps version for proper caption sync
    const { audioBuffer, wordTimings } = await generateSpeechWithTimestamps(text, voiceId, options);

    // Save to temp file first
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `voiceover-${projectId}-${Date.now()}.mp3`);
    fs.writeFileSync(tempFile, audioBuffer);

    try {
        // Upload to S3
        const s3Key = `voiceovers/${projectId}/${Date.now()}.mp3`;
        const result = await uploadToS3(tempFile, s3Key, 'audio/mpeg');

        // Calculate actual duration from word timings
        const duration = wordTimings.length > 0
            ? wordTimings[wordTimings.length - 1].end
            : (text.split(/\s+/).length / 150) * 60;

        console.log(`🎤 Generated voiceover with ${wordTimings.length} word timings, duration: ${duration.toFixed(2)}s`);

        return {
            audioBuffer,
            s3Key,
            s3Url: result.url,
            localPath: tempFile,
            duration,
            wordTimings,
        };
    } catch (error) {
        // Clean up temp file on error
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        throw error;
    }
}

/**
 * Generate speech for a dialogue with multiple speakers
 */
export interface DialogueLine {
    speaker: string; // voice ID
    text: string;
}

export async function generateDialogue(
    lines: DialogueLine[],
    projectId: string,
    options: TTSOptions = {}
): Promise<TTSResult[]> {
    const results: TTSResult[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        console.log(`Generating line ${i + 1}/${lines.length} for speaker ${line.speaker}`);

        const result = await generateSpeechToS3(
            line.text,
            line.speaker,
            `${projectId}/line-${i}`,
            options
        );
        results.push(result);

        // Add a small delay to avoid rate limiting
        if (i < lines.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return results;
}

/**
 * Get voice info by ID
 */
export function getVoiceById(voiceId: string): VoiceInfo | null {
    const profile = VOICE_PROFILES[voiceId];
    if (profile) {
        return {
            id: voiceId,
            name: profile.name,
            description: profile.description,
        };
    }
    return null;
}

/**
 * Estimate audio duration from text
 */
export function estimateAudioDuration(text: string): number {
    // Average speaking rate: ~150 words per minute
    const wordCount = text.split(/\s+/).length;
    return (wordCount / 150) * 60; // in seconds
}
