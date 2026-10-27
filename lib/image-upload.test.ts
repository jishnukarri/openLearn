import { describe, it, expect } from "vitest";
import { validateImageUpload, MAX_IMAGE_BYTES } from "./image-upload";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
const text = new TextEncoder().encode("<svg onload=alert(1)>");

describe("validateImageUpload", () => {
  it("accepts a real png", () => expect(validateImageUpload("image/png", 100, png)).toBeNull());
  it("rejects svg", () => expect(validateImageUpload("image/svg+xml", 20, text)).not.toBeNull());
  it("rejects a mislabelled file", () => expect(validateImageUpload("image/png", 20, text)).not.toBeNull());
  it("rejects oversize and empty", () => {
    expect(validateImageUpload("image/png", MAX_IMAGE_BYTES + 1, png)).not.toBeNull();
    expect(validateImageUpload("image/png", 0, png)).not.toBeNull();
  });
});
