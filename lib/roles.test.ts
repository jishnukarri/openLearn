import { describe, expect, it } from "vitest";
import { canManageSubject } from "./roles";

describe("canManageSubject", () => {
  it("allows an admin regardless of ownership", () => {
    expect(
      canManageSubject({ id: "admin-1", role: "admin" }, { created_by: "teacher-1" })
    ).toBe(true);
  });

  it("allows a teacher who owns the subject", () => {
    expect(
      canManageSubject({ id: "teacher-1", role: "teacher" }, { created_by: "teacher-1" })
    ).toBe(true);
  });

  it("denies a teacher who does not own the subject", () => {
    expect(
      canManageSubject({ id: "teacher-2", role: "teacher" }, { created_by: "teacher-1" })
    ).toBe(false);
  });

  it("denies a student", () => {
    expect(
      canManageSubject({ id: "student-1", role: "student" }, { created_by: "student-1" })
    ).toBe(false);
  });
});
