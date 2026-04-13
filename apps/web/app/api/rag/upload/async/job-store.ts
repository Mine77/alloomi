// Shared job storage for async uploads
export interface UploadJob {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: any;
  error?: string;
  createdAt: Date;
}

// In-memory job storage (in production, use Redis or database)
export const jobs = new Map<string, UploadJob>();
