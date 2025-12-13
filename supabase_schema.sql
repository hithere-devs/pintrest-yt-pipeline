-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create User table
create table if not exists "User" (
  "id" text primary key,
  "email" text,
  "accessToken" text,
  "refreshToken" text,
  "tokenExpiry" timestamp with time zone,
  "createdAt" timestamp with time zone default now()
);

-- Create Video table
create table if not exists "Video" (
  "id" uuid primary key default uuid_generate_v4(),
  "userId" text references "User"("id"),
  "pinterestUrl" text not null,
  "status" text not null default 'QUEUED',
  "createdAt" timestamp with time zone default now(),
  "updatedAt" timestamp with time zone default now(),
  "downloadedAt" timestamp with time zone,
  "localFilePath" text,
  "youtubeVideoId" text,
  "youtubeUrl" text,
  "uploadedAt" timestamp with time zone,
  "youtubeTitle" text,
  "youtubeDesc" text,
  "thumbnailUrl" text,
  "errorMessage" text,
  "pinterestTitle" text,
  "pinterestDescription" text
);

-- Create indexes
create index if not exists "Video_userId_idx" on "Video"("userId");
create index if not exists "Video_status_idx" on "Video"("status");

-- Create Frame table for extracted video frames
create table if not exists "Frame" (
  "id" uuid primary key default uuid_generate_v4(),
  "videoId" uuid references "Video"("id") on delete cascade,
  "index" integer not null,
  "timestamp" decimal not null,
  "s3Url" text,
  "localPath" text,
  "description" text,
  "createdAt" timestamp with time zone default now()
);

create index if not exists "Frame_videoId_idx" on "Frame"("videoId");

-- Create ResearchTask table for deep research tracking
create table if not exists "ResearchTask" (
  "id" uuid primary key default uuid_generate_v4(),
  "videoId" uuid references "Video"("id") on delete cascade,
  "userId" text references "User"("id"),
  "status" text not null default 'pending',
  "title" text,
  "description" text,
  "hashtags" text[],
  "thumbnailPrompt" text,
  "researchInsights" text,
  "theme" text,
  "error" text,
  "startedAt" timestamp with time zone default now(),
  "completedAt" timestamp with time zone,
  "createdAt" timestamp with time zone default now()
);

create index if not exists "ResearchTask_videoId_idx" on "ResearchTask"("videoId");
create index if not exists "ResearchTask_status_idx" on "ResearchTask"("status");

-- ============================================
-- Viral Video Generator Tables
-- ============================================

-- Create AssetLibrary table for videos, music, and voice profiles
create table if not exists "AssetLibrary" (
  "id" uuid primary key default uuid_generate_v4(),
  "type" text not null check ("type" in ('video', 'music', 'voice')),
  "name" text not null,
  "description" text,
  "s3Key" text not null,
  "s3Url" text not null,
  "thumbnailUrl" text,
  "duration" decimal,
  "metadata" jsonb default '{}',
  "tags" text[],
  "isActive" boolean default true,
  "createdAt" timestamp with time zone default now(),
  "updatedAt" timestamp with time zone default now()
);

create index if not exists "AssetLibrary_type_idx" on "AssetLibrary"("type");
create index if not exists "AssetLibrary_isActive_idx" on "AssetLibrary"("isActive");

-- Create ViralVideoProject table for tracking video generation projects
create table if not exists "ViralVideoProject" (
  "id" uuid primary key default uuid_generate_v4(),
  "userId" text references "User"("id"),
  "status" text not null default 'draft' check ("status" in ('draft', 'generating_script', 'generating_voiceover', 'compositing', 'completed', 'failed', 'scheduled')),
  "name" text,
  "backgroundVideoId" uuid references "AssetLibrary"("id"),
  "musicId" uuid references "AssetLibrary"("id"),
  "voiceId" text,
  "voiceName" text,
  "scriptContent" text,
  "scriptType" text check ("scriptType" in ('monologue', 'dialogue', 'narration')),
  "voiceoverS3Key" text,
  "voiceoverS3Url" text,
  "voiceoverDuration" decimal,
  "captionSettings" jsonb default '{"font": "Montserrat", "fontSize": 48, "fontColor": "#FFFFFF", "strokeColor": "#000000", "strokeWidth": 2, "position": "bottom", "animation": "fade"}',
  "finalVideoS3Key" text,
  "finalVideoS3Url" text,
  "finalVideoDuration" decimal,
  "researchPrompt" text,
  "researchResult" text,
  "errorMessage" text,
  "createdAt" timestamp with time zone default now(),
  "updatedAt" timestamp with time zone default now(),
  "completedAt" timestamp with time zone
);

create index if not exists "ViralVideoProject_userId_idx" on "ViralVideoProject"("userId");
create index if not exists "ViralVideoProject_status_idx" on "ViralVideoProject"("status");

-- Create ScheduledVideo table for scheduling generated videos
create table if not exists "ScheduledVideo" (
  "id" uuid primary key default uuid_generate_v4(),
  "projectId" uuid references "ViralVideoProject"("id") on delete cascade,
  "userId" text references "User"("id"),
  "scheduledAt" timestamp with time zone not null,
  "youtubeTitle" text,
  "youtubeDescription" text,
  "youtubeTags" text[],
  "youtubePrivacy" text default 'private' check ("youtubePrivacy" in ('public', 'private', 'unlisted')),
  "youtubeVideoId" text,
  "youtubeUrl" text,
  "status" text not null default 'pending' check ("status" in ('pending', 'uploading', 'uploaded', 'failed')),
  "errorMessage" text,
  "uploadedAt" timestamp with time zone,
  "createdAt" timestamp with time zone default now()
);

create index if not exists "ScheduledVideo_userId_idx" on "ScheduledVideo"("userId");
create index if not exists "ScheduledVideo_scheduledAt_idx" on "ScheduledVideo"("scheduledAt");
create index if not exists "ScheduledVideo_status_idx" on "ScheduledVideo"("status");
