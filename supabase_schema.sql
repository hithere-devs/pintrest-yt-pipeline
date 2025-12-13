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
  "errorMessage" text
);

-- Create indexes
create index if not exists "Video_userId_idx" on "Video"("userId");
create index if not exists "Video_status_idx" on "Video"("status");
