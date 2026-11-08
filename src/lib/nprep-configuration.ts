export const NPREP_API_DOMAIN = "https://api.nprep.in";

export type NprepConfigurationDraft = {
  apiDomain: string;
  credentialReference: string;
};

// Non-secret draft only, held in this tab's memory. No credentials or approval
// claims are persisted, and this draft never changes the live pass-through.
let draft: NprepConfigurationDraft | undefined;

export function validateNprepConfiguration(value: NprepConfigurationDraft): string | undefined {
  if (value.apiDomain !== NPREP_API_DOMAIN) return "Use the NPrep API domain https://api.nprep.in.";
  if (!/^[A-Z_][A-Z0-9_]{0,255}$/.test(value.credentialReference)) {
    return "Enter a server secret name, such as NPREP_API_KEY—not the key itself.";
  }
  return undefined;
}

export function saveNprepConfigurationDraft(value: NprepConfigurationDraft) {
  const error = validateNprepConfiguration(value);
  if (error) throw new Error(error);
  draft = { apiDomain: NPREP_API_DOMAIN, credentialReference: value.credentialReference };
}

export function getNprepConfigurationDraft() {
  return draft ? { ...draft } : undefined;
}

export function clearNprepConfigurationDraft() { draft = undefined; }

export function nprepApprovalStatus(): "not-approved" {
  // A saved draft, working endpoint, or user checkbox is not provider approval.
  return "not-approved";
}