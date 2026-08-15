import { useState, useEffect } from "react";
import { GraduationCap, Building2, Hash, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudentProfile } from "@/types";
import { saveStudentProfile } from "@/lib/profile";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: StudentProfile | null;
  onSave: (profile: StudentProfile) => void;
  title?: string;
  description?: string;
}

export function ProfileEditModal({
  isOpen,
  onClose,
  currentProfile,
  onSave,
  title,
  description,
}: ProfileEditModalProps) {
  const [branch, setBranch] = useState("");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [errors, setErrors] = useState<{ branch?: string; enrollmentNumber?: string }>({});

  useEffect(() => {
    if (isOpen) {
      if (currentProfile) {
        setBranch(currentProfile.branch);
        setEnrollmentNumber(currentProfile.enrollmentNumber);
      } else {
        setBranch("");
        setEnrollmentNumber("");
      }
      setErrors({});
    }
  }, [isOpen, currentProfile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { branch?: string; enrollmentNumber?: string } = {};

    if (!branch.trim()) {
      newErrors.branch = "Branch is required (e.g., CE, IT, ME)";
    }
    if (!enrollmentNumber.trim()) {
      newErrors.enrollmentNumber = "Enrollment number is required (e.g., 25002170110091)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const saved = saveStudentProfile({
      branch: branch.trim().toUpperCase(),
      enrollmentNumber: enrollmentNumber.trim(),
    });
    onSave(saved);
    onClose();
  };

  const isEditing = Boolean(currentProfile);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg">
              {title || (isEditing ? "Edit Student Details" : "Student Profile Registration")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {description ||
              (isEditing
                ? "Update your saved Branch and Enrollment Number for future PDF submissions."
                : "Save your Branch and Enrollment Number once. They will be stored in your browser and automatically used for all PDF assignments.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="modal-branch"
              className="text-xs font-semibold flex items-center gap-1.5"
            >
              <Building2 className="h-3.5 w-3.5 text-primary" />
              Branch *
            </Label>
            <Input
              id="modal-branch"
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value.toUpperCase());
                if (errors.branch) setErrors((prev) => ({ ...prev, branch: undefined }));
              }}
              placeholder="e.g. CE, IT, ME, EC"
              maxLength={20}
              className="text-xs uppercase"
              aria-invalid={Boolean(errors.branch)}
              autoFocus={!isEditing}
            />
            {errors.branch ? (
              <p className="text-xs text-destructive">{errors.branch}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Your college/engineering branch code
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="modal-enrollment"
              className="text-xs font-semibold flex items-center gap-1.5"
            >
              <Hash className="h-3.5 w-3.5 text-primary" />
              Enrollment Number *
            </Label>
            <Input
              id="modal-enrollment"
              value={enrollmentNumber}
              onChange={(e) => {
                setEnrollmentNumber(e.target.value);
                if (errors.enrollmentNumber)
                  setErrors((prev) => ({ ...prev, enrollmentNumber: undefined }));
              }}
              placeholder="e.g. 25002170110091"
              maxLength={40}
              className="text-xs font-mono"
              aria-invalid={Boolean(errors.enrollmentNumber)}
            />
            {errors.enrollmentNumber ? (
              <p className="text-xs text-destructive">{errors.enrollmentNumber}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Your university student ID or roll number
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 p-2.5 border border-border text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Example generated filename: </span>
            <span className="font-mono text-primary font-medium">
              {`${branch.trim() || "BRANCH"}_${enrollmentNumber.trim() || "ENROLL"}_DS_T1.pdf`}
            </span>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            {isEditing && (
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" className="gap-1.5">
              <Check className="h-4 w-4" />
              {isEditing ? "Save Changes" : "Save Profile Details"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
