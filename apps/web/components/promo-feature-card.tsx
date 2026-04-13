"use client";

import React from "react";

interface PromoFeatureCardProps {
  title: string;
  description: string;
  videoUrl: string;
}

/**
 * Simplified feature card component - for promo pages
 * Displays feature title, description and video
 */
export const PromoFeatureCard: React.FC<PromoFeatureCardProps> = ({
  title,
  description,
  videoUrl,
}) => {
  /**
   * Check if it is a local video path
   */
  const isLocalVideo = (url: string) => {
    return (
      url.startsWith("/") ||
      url.endsWith(".mp4") ||
      url.endsWith(".webm") ||
      url.endsWith(".mov")
    );
  };

  /**
   * Convert YouTube URL to embed format
   */
  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return "";

    // Handle YouTube Shorts
    const shortsMatch = url.match(
      /(?:youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    if (shortsMatch?.[1]) {
      const videoId = shortsMatch[1];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
    }

    // Handle standard YouTube URL
    const regExp =
      /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11}).*/;
    const match = url.match(regExp);
    const videoId = match?.[1] && match[1].length === 11 ? match[1] : null;
    if (!videoId) return "";

    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
  };

  const isLocal = isLocalVideo(videoUrl);
  const embedUrl = isLocal ? null : getYouTubeEmbedUrl(videoUrl);

  return (
    <div className="bg-white p-6 border-2 border-border-primary hover:border-deepwater transition-all flex flex-col md:flex-row gap-6 md:gap-6 items-center h-auto md:h-[720px] rounded-3xl shadow-lg hover:shadow-2xl">
      {/* Text area */}
      <div className="w-full md:flex-1 md:max-w-[640px] flex-shrink-0 flex flex-col justify-center gap-0">
        <h3 className="text-xl md:text-2xl font-medium mb-2 text-foreground">
          {title}
        </h3>
        <p className="text-foreground-muted text-base leading-6 text-left">
          {description.split("<br/>").map((part, index, array) => (
            <React.Fragment key={`${index}-${part}`}>
              {part}
              {index < array.length - 1 && <br />}
            </React.Fragment>
          ))}
        </p>
      </div>

      {/* Video area */}
      <div className="w-full md:flex-1 flex-shrink-0 md:h-full flex items-center justify-center">
        <div className="relative w-full aspect-square md:aspect-auto md:h-full md:w-full rounded-lg overflow-hidden">
          {isLocal ? (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              controls={false}
            />
          ) : embedUrl ? (
            <iframe
              className="absolute inset-0 w-full h-full"
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 bg-zinc-200 flex items-center justify-center text-foreground-muted">
              Video loading...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
