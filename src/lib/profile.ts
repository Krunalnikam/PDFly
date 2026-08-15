import { StudentProfile } from "@/types";

export const STUDENT_PROFILE_STORAGE_KEY = "pdfmaker_student_profile";

/**
 * Retrieves the saved student profile from localStorage.
 * Returns null if no profile is saved or if data is invalid.
 */
export function getSavedProfile(): StudentProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.branch === "string" &&
      parsed.branch.trim().length > 0 &&
      typeof parsed.enrollmentNumber === "string" &&
      parsed.enrollmentNumber.trim().length > 0
    ) {
      return {
        branch: parsed.branch.trim().toUpperCase(),
        enrollmentNumber: parsed.enrollmentNumber.trim(),
      };
    }
    return null;
  } catch (err) {
    console.error("Failed to load student profile from localStorage:", err);
    return null;
  }
}

/**
 * Saves or updates the student profile in localStorage.
 */
export function saveStudentProfile(profile: StudentProfile): StudentProfile {
  const cleanProfile: StudentProfile = {
    branch: profile.branch.trim().toUpperCase(),
    enrollmentNumber: profile.enrollmentNumber.trim(),
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(cleanProfile));
  }
  return cleanProfile;
}

/**
 * Clears the saved student profile from localStorage.
 */
export function clearStudentProfile(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STUDENT_PROFILE_STORAGE_KEY);
  }
}
