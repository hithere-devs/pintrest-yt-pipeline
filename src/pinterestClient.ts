import axios from 'axios';
import { load } from 'cheerio';

const DEFAULT_HEADERS: Record<string, string> = {
    'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Referer: 'https://www.pinterest.com/',
};

async function fetchHtml(url: string): Promise<string> {
    const response = await axios.get<string>(url, { headers: DEFAULT_HEADERS });
    return response.data;
}

async function resolveShortLink(url: string): Promise<string> {
    const response = await axios.get<string>(url, { headers: DEFAULT_HEADERS });
    const $ = load(response.data);
    const alternate = $('link[rel="alternate"]').attr('href');
    if (!alternate) {
        throw new Error('Unable to resolve Pinterest short link.');
    }
    const match = /url=([^&]+)/.exec(alternate);
    if (match && match[1]) {
        return decodeURIComponent(match[1]);
    }
    return alternate;
}

function promoteMp4Url(videoSrc: string): string {
    if (!videoSrc) {
        throw new Error('Missing video source URL on Pinterest page.');
    }
    if (videoSrc.includes('.m3u8')) {
        return videoSrc.replace('hls', '720p').replace('m3u8', 'mp4');
    }
    return videoSrc;
}

export async function resolvePinUrl(url: string): Promise<string> {
    if (url.includes('pin.it/')) {
        return resolveShortLink(url);
    }
    return url;
}

export async function extractVideoUrl(pageUrl: string): Promise<string> {
    const html = await fetchHtml(pageUrl);
    const $ = load(html);
    let videoSrc: string | undefined;

    const specificClassVideo = $('video.hwa.kVc.MIw.L4E').attr('src');
    if (specificClassVideo) {
        videoSrc = specificClassVideo;
    }

    if (!videoSrc) {
        videoSrc = $('video')
            .toArray()
            .map((element) => $(element).attr('src'))
            .find((src): src is string => typeof src === 'string' && src.includes('pinimg.com'));
    }

    if (!videoSrc) {
        throw new Error('Unable to locate Pinterest video source.');
    }

    return promoteMp4Url(videoSrc);
}
