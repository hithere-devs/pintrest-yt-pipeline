import { supabase } from './supabaseClient';
import type { VideoStatus } from './types';
import { randomUUID } from 'crypto';

export interface DbVideo {
    id: string;
    userId: string;
    pinterestUrl: string;
    status: VideoStatus;
    downloadedAt?: string;
    localFilePath?: string;
    youtubeVideoId?: string;
    youtubeUrl?: string;
    uploadedAt?: string;
    youtubeTitle?: string;
    youtubeDesc?: string;
    thumbnailUrl?: string;
    errorMessage?: string;
}

export async function getNextQueuedVideo(): Promise<DbVideo | null> {
    const { data, error } = await supabase
        .from('Video')
        .select('*')
        .eq('status', 'QUEUED')
        .order('createdAt', { ascending: true })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching next video:', error);
        return null;
    }

    return data;
}

export async function updateVideoStatus(id: string, updates: Partial<DbVideo>) {
    const { error } = await supabase
        .from('Video')
        .update({ ...updates, updatedAt: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error(`Error updating video ${id}:`, error);
        throw error;
    }
}

export async function getUserTokens(userId: string) {
    const { data, error } = await supabase
        .from('User')
        .select('accessToken, refreshToken, tokenExpiry')
        .eq('id', userId)
        .single();

    if (error) {
        console.error(`Error fetching tokens for user ${userId}:`, error);
        throw error;
    }
    return data;
}

export async function addVideoToQueue(userId: string, url: string) {
    const { data, error } = await supabase
        .from('Video')
        .insert({
            id: randomUUID(),
            userId,
            pinterestUrl: url,
            status: 'QUEUED',
            updatedAt: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        throw error;
    }
    return data;
}

export async function getLastUploadTime(userId: string): Promise<Date | null> {
    const { data, error } = await supabase
        .from('Video')
        .select('uploadedAt')
        .eq('userId', userId)
        .eq('status', 'UPLOADED')
        .order('uploadedAt', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        console.error('Error fetching last upload time:', error);
        return null;
    }

    return data.uploadedAt ? new Date(data.uploadedAt) : null;
}

export async function saveUserTokens(userId: string, tokens: any, email?: string, youtubeId?: string) {
    const updates: any = {
        id: userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date || Date.now() + 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (email) {
        updates.email = email;
    }

    if (youtubeId) {
        updates.youtubeId = youtubeId;
    }

    const { error } = await supabase
        .from('User')
        .upsert(updates, { onConflict: 'id' });

    if (error) throw error;
}

export async function getUserQueue(userId: string) {
    const { data, error } = await supabase
        .from('Video')
        .select('*')
        .eq('userId', userId)
        .eq('status', 'QUEUED')
        .order('createdAt', { ascending: true });

    if (error) throw error;
    return data;
}

export async function getUserHistory(userId: string, limit = 10) {
    const { data, error } = await supabase
        .from('Video')
        .select('*')
        .eq('userId', userId)
        .neq('status', 'QUEUED')
        .order('updatedAt', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

export async function deleteVideo(userId: string, videoId: string) {
    const { error } = await supabase
        .from('Video')
        .delete()
        .eq('id', videoId)
        .eq('userId', userId);

    if (error) throw error;
}
