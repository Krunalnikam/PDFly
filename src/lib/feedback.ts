import {
  submitFeedbackServerFn,
  type FeedbackType,
  type StoredFeedbackItem,
} from "./feedback-server";

export type { FeedbackType, StoredFeedbackItem as FeedbackItem };

/**
 * Persistently submits feedback to the secure server database.
 */
export async function submitFeedback(data: {
  type: FeedbackType;
  rating: number;
  message: string;
  email?: string;
  language?: string;
}): Promise<{ success: boolean; id: string; error?: string }> {
  // Validate message
  const trimmedMessage = data.message.trim();
  if (!trimmedMessage) {
    return { success: false, id: "", error: "Message cannot be empty" };
  }
  if (trimmedMessage.length > 1000) {
    return { success: false, id: "", error: "Message exceeds 1000 characters limit" };
  }

  // Validate optional email format
  const trimmedEmail = data.email?.trim();
  if (trimmedEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return { success: false, id: "", error: "Invalid email address format" };
    }
  }

  // Ensure rating is within 1-5
  const rating = Math.min(5, Math.max(1, Math.round(data.rating || 5)));

  try {
    const res = await submitFeedbackServerFn({
      data: {
        type: data.type,
        rating,
        message: trimmedMessage,
        email: trimmedEmail || undefined,
        language: data.language || "en",
      },
    });

    if (res && res.success) {
      return { success: true, id: res.id };
    }

    return { success: false, id: "", error: "Failed to save feedback to server" };
  } catch (err: unknown) {
    console.error("Failed to submit feedback to backend:", err);
    return {
      success: false,
      id: "",
      error: err instanceof Error ? err.message : "Failed to connect to backend",
    };
  }
}
