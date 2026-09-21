// Pure grouping logic, kept separate from app/actions/paper-marking.ts
// because a "use server" file may only export async functions — this has
// to live in a plain module either way, which also makes it trivially
// testable without any Server Action machinery.
//
// A file with a recognized/unrecognized code starts a new group; a file
// with no detectable code continues whatever group is currently open (a
// student who only writes their code on page 1 of a multi-photo upload).
export type FileGroup = {
  rosterEntryId: string | null;
  detectedCode: string | null;
  fileIndices: number[];
};

export function groupFilesByReferenceCode(
  codes: (string | null)[],
  rosterByCode: Map<string, string>
): FileGroup[] {
  const groups: FileGroup[] = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (code !== null) {
      groups.push({ rosterEntryId: rosterByCode.get(code) ?? null, detectedCode: code, fileIndices: [i] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].fileIndices.push(i);
    } else {
      groups.push({ rosterEntryId: null, detectedCode: null, fileIndices: [i] });
    }
  }
  return groups;
}
