"""
Pinterest video downloader
Made by Harshit
Modified for video-pipeline integration
"""

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
import os
import re
from datetime import datetime
import sys
import json


def get_video_and_audio_urls(m3u8_url):
    """
    Convert m3u8 playlist URL to downloadable video and audio URLs.
    Returns a tuple: (video_url, audio_url, method_used)
    """
    try:
        # Method 1: Try the old conversion method first (hls -> 720p, m3u8 -> mp4)
        simple_convert_url = m3u8_url.replace("hls", "720p").replace("m3u8", "mp4")
        response = requests.head(simple_convert_url)
        if response.status_code == 200:
            return simple_convert_url, None, "simple"

        # Method 2: Parse the HLS playlist to find video and audio streams
        response = requests.get(m3u8_url)
        if response.status_code != 200:
            return None, None, "failed"

        playlist_content = response.text
        base_url = m3u8_url.rsplit("/", 1)[0] + "/"

        # Extract audio URL first
        audio_url = None
        audio_match = re.search(r'URI="([^"]*_audio\.m3u8)"', playlist_content)
        if audio_match:
            audio_playlist_url = base_url + audio_match.group(1)

            audio_response = requests.get(audio_playlist_url)
            if audio_response.status_code == 200:
                audio_content = audio_response.text
                for line in audio_content.split("\n"):
                    if line.endswith(".cmfa"):
                        audio_file_url = base_url + line.strip()
                        check_response = requests.head(audio_file_url)
                        if check_response.status_code == 200:
                            audio_url = audio_file_url
                            break

        # Extract video URL
        video_url = None
        quality_order = ["720w", "540w", "360w", "240w"]

        for quality in quality_order:
            if f"_{quality}.m3u8" in playlist_content:
                stream_url = base_url + m3u8_url.split("/")[-1].replace(
                    ".m3u8", f"_{quality}.m3u8"
                )

                stream_response = requests.get(stream_url)
                if stream_response.status_code == 200:
                    stream_content = stream_response.text

                    for line in stream_content.split("\n"):
                        if line.endswith(".cmfv"):
                            video_file_url = base_url + line.strip()
                            check_response = requests.head(video_file_url)
                            if check_response.status_code == 200:
                                video_url = video_file_url
                                break

                if video_url:
                    break

        # Method 3: Look for any MP4 files mentioned in the playlist
        if not video_url:
            for line in playlist_content.split("\n"):
                if ".mp4" in line and line.startswith("http"):
                    check_response = requests.head(line.strip())
                    if check_response.status_code == 200:
                        video_url = line.strip()
                        break

        if video_url:
            method = "hls_separate" if audio_url else "hls_video_only"
            return video_url, audio_url, method
        else:
            return None, None, "failed"

    except Exception as e:
        return None, None, "failed"


def merge_video_audio(video_file, audio_file, output_file):
    """
    Merge video and audio files using ffmpeg with @faith_&_fork watermark.
    Returns True if successful, False otherwise.
    """
    try:
        import subprocess

        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True)
        if result.returncode != 0:
            return False

        # Add watermark using drawtext filter
        # Position: bottom center (x=(w-text_w)/2, y=h-th-20)
        # Style: white text with black shadow/box for readability
        cmd = [
            "ffmpeg",
            "-i",
            video_file,
            "-i",
            audio_file,
            "-c:a",
            "copy",
            "-c:v",
            "libx264",
            "-vf",
            "drawtext=text='@faithandfork':fontsize=20:fontcolor=white:x=(w-text_w)/2:y=h-th-200:box=1:boxcolor=black@0.5:boxborderw=5",
            "-y",
            output_file,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            os.remove(video_file)
            os.remove(audio_file)
            return True
        else:
            return False

    except Exception:
        return False


def download_file(url, filename):
    try:
        response = requests.get(url, stream=True)

        if response.status_code != 200:
            return False

        file_size = int(response.headers.get("Content-Length", 0))

        with open(filename, "wb") as f:
            bytes_written = 0
            for data in response.iter_content(1024):
                if data:
                    f.write(data)
                    bytes_written += len(data)

        if bytes_written == 0:
            os.remove(filename)
            return False
        else:
            return True

    except Exception:
        return False


def extract_pinterest_metadata(soup):
    """
    Extract metadata from Pinterest page (title, description, keywords).
    Returns a dictionary with extracted information.
    """
    metadata = {"title": None, "description": None, "keywords": []}

    # Try to extract title from meta tags
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        metadata["title"] = og_title["content"]

    # Try twitter:title as fallback
    if not metadata["title"]:
        twitter_title = soup.find("meta", attrs={"name": "twitter:title"})
        if twitter_title and twitter_title.get("content"):
            metadata["title"] = twitter_title["content"]

    # Try regular title tag as last resort
    if not metadata["title"]:
        title_tag = soup.find("title")
        if title_tag:
            metadata["title"] = title_tag.get_text().strip()

    # Extract description from meta tags
    og_description = soup.find("meta", property="og:description")
    if og_description and og_description.get("content"):
        metadata["description"] = og_description["content"]

    # Try description meta tag as fallback
    if not metadata["description"]:
        desc_tag = soup.find("meta", attrs={"name": "description"})
        if desc_tag and desc_tag.get("content"):
            metadata["description"] = desc_tag["content"]

    # Extract keywords/tags
    keywords_tag = soup.find("meta", attrs={"name": "keywords"})
    if keywords_tag and keywords_tag.get("content"):
        keywords = keywords_tag["content"].split(",")
        metadata["keywords"] = [k.strip() for k in keywords if k.strip()]

    return metadata


def download_pinterest_video(page_url, output_dir):
    """
    Download a Pinterest video from the given URL.
    Returns a JSON string with file path and metadata.
    """
    # Resolve short URLs
    if "https://pin.it/" in page_url:
        t_body = requests.get(page_url)
        if t_body.status_code != 200:
            raise Exception("Invalid URL or network error")
        soup = BeautifulSoup(t_body.content, "html.parser")
        href_link = (soup.find("link", rel="alternate"))["href"]
        match = re.search("url=(.*?)&", href_link)
        page_url = match.group(1)

    # Fetch page content
    body = requests.get(page_url)
    if body.status_code != 200:
        raise Exception("Failed to fetch Pinterest page")

    soup = BeautifulSoup(body.content, "html.parser")

    # Extract metadata from Pinterest page
    pin_metadata = extract_pinterest_metadata(soup)

    # Extract video URL
    extract_url = None

    # Method 1: Look for video element with specific classes
    video_element = soup.find("video", class_="hwa kVc MIw L4E")
    if video_element and video_element.get("src"):
        extract_url = video_element["src"]

    # Method 2: Look for any video element
    if not extract_url:
        video_element = soup.find("video")
        if video_element and video_element.get("src"):
            extract_url = video_element["src"]

    # Method 3: Look for video URLs in page content
    if not extract_url:
        page_text = str(soup)
        video_patterns = [
            r'https://v1\.pinimg\.com/videos/[^"\']*\.m3u8',
            r'https://v1\.pinimg\.com/videos/[^"\']*\.mp4',
            r'"videoUrl":"([^"]*)"',
            r'"video_url":"([^"]*)"',
        ]

        for pattern in video_patterns:
            matches = re.findall(pattern, page_text)
            if matches:
                extract_url = matches[0]
                break

    if not extract_url:
        raise Exception("Could not find video URL on Pinterest page")

    # Get downloadable video and audio URLs
    if extract_url.endswith(".m3u8"):
        video_url, audio_url, method = get_video_and_audio_urls(extract_url)
        if not video_url:
            raise Exception("Could not find downloadable video from playlist")
    else:
        video_url = extract_url
        audio_url = None
        method = "direct"

    # Generate filename
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    final_filename = os.path.join(output_dir, f"{timestamp}.mp4")

    if audio_url:
        # Download video and audio separately, then merge
        video_filename = os.path.join(output_dir, f"{timestamp}_video.mp4")
        audio_filename = os.path.join(output_dir, f"{timestamp}_audio.mp4")

        video_success = download_file(video_url, video_filename)
        if not video_success:
            raise Exception("Failed to download video track")

        audio_success = download_file(audio_url, audio_filename)
        if not audio_success:
            os.remove(video_filename)
            raise Exception("Failed to download audio track")

        merge_success = merge_video_audio(
            video_filename, audio_filename, final_filename
        )
        if not merge_success:
            # Keep separate files if merge fails
            return {"filePath": video_filename, "metadata": pin_metadata}
    else:
        # Download single file
        success = download_file(video_url, final_filename)
        if not success:
            raise Exception("Failed to download video file")

    return {"filePath": final_filename, "metadata": pin_metadata}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(
            json.dumps(
                {"error": "Usage: python pinterest_downloader.py <url> <output_dir>"}
            )
        )
        sys.exit(1)

    url = sys.argv[1]
    output_dir = sys.argv[2]

    try:
        result = download_pinterest_video(url, output_dir)
        print(
            json.dumps(
                {
                    "success": True,
                    "filePath": result["filePath"],
                    "metadata": result["metadata"],
                }
            )
        )
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
