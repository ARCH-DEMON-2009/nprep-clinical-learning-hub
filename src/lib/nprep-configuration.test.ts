import { beforeEach, describe, expect, it } from "vitest";
import { clearNprepConfigurationDraft, getNprepConfigurationDraft, nprepApprovalStatus, NPREP_API_DOMAIN, saveNprepConfigurationDraft, validateNprepConfiguration } from "./nprep-configuration";

beforeEach(clearNprepConfigurationDraft);

describe("authorized NPrep configuration", () => {
  it("accepts only api.nprep.in and never an arbitrary credential destination", () => {
    expect(validateNprepConfiguration({ apiDomain: "https://example.com", credentialReference: "NPREP_API_KEY" })).toBeDefined();
    expect(validateNprepConfiguration({ apiDomain: NPREP_API_DOMAIN, credentialReference: "NPREP_API_KEY" })).toBeUndefined();
  });
  it("accepts secret references rather than bearer credentials", () => {
    expect(validateNprepConfiguration({ apiDomain: NPREP_API_DOMAIN, credentialReference: "Bearer private-token" })).toBeDefined();
  });
  it("does not infer approval from saving a configuration draft", () => {
    saveNprepConfigurationDraft({ apiDomain: NPREP_API_DOMAIN, credentialReference: "NPREP_API_KEY" });
    expect(getNprepConfigurationDraft()?.credentialReference).toBe("NPREP_API_KEY");
    expect(nprepApprovalStatus()).toBe("not-approved");
  });
  it("can clear the temporary draft", () => {
    saveNprepConfigurationDraft({ apiDomain: NPREP_API_DOMAIN, credentialReference: "NPREP_API_KEY" });
    clearNprepConfigurationDraft();
    expect(getNprepConfigurationDraft()).toBeUndefined();
  });
});