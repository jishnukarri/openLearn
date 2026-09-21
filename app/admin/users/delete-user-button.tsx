"use client";

import { deleteUserAccountAction } from "@/app/actions/admin-users";

// Confirm before firing, this deletes the profile (progress, answers,
// class memberships cascade) and their Appwrite login, not just a role
// change like the rest of this page.
export function DeleteUserButton({
  profileId,
  label,
}: {
  profileId: string;
  label: string;
}) {
  return (
    <form
      action={deleteUserAccountAction}
      onSubmit={(e) => {
        if (!confirm(`Permanently delete ${label}'s account? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="profileId" value={profileId} />
      <button type="submit" className="text-xs text-error hover:underline">
        Delete
      </button>
    </form>
  );
}
