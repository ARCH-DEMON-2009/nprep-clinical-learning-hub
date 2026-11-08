import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, KeyRound, Save, ShieldAlert, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearNprepConfigurationDraft, getNprepConfigurationDraft, NPREP_API_DOMAIN, saveNprepConfigurationDraft } from "@/lib/nprep-configuration";

export const Route = createFileRoute("/api-configuration")({
  head: () => ({ meta: [
    { title: "Authorized API Setup — NPrep" },
    { name: "description", content: "Review NPrep API authorization and prepare a secure credential reference." },
    { property: "og:title", content: "Authorized API Setup — NPrep" },
    { property: "og:description", content: "Review NPrep API authorization and prepare a secure credential reference." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ApiConfiguration,
});

function ApiConfiguration() {
  const [reference, setReference] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const draft = getNprepConfigurationDraft();
    if (draft) { setReference(draft.credentialReference); setSaved(true); }
  }, []);
  return <div className="mx-auto max-w-3xl">
    <PageTitle title="NPrep API setup" />
    <section aria-label="API approval" className="mb-8 border-y border-destructive/30 bg-destructive/5 py-5 px-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-2">
          <h2 className="font-semibold text-destructive">Access not approved</h2>
          <p className="text-sm text-foreground">No verified NPrep authorization is configured for this website. Sign-in and protected lectures are not confirmed available.</p>
          <p className="text-sm text-muted-foreground">NPrep must confirm permission for your website and supply its approved web connection details. Saving a draft does not grant access.</p>
        </div>
      </div>
    </section>
    <form className="space-y-6" onSubmit={(event) => {
      event.preventDefault(); setError(""); setSaved(false);
      try { saveNprepConfigurationDraft({ apiDomain: NPREP_API_DOMAIN, credentialReference: reference.trim() }); setSaved(true); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "The draft could not be saved."); }
    }}>
      <div className="space-y-2">
        <label htmlFor="api-domain" className="flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4 text-muted-foreground" />API domain</label>
        <Input id="api-domain" value={NPREP_API_DOMAIN} readOnly />
        <p className="text-xs text-muted-foreground">Only api.nprep.in is accepted. Your existing NPrep connection remains unchanged.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="credential-reference" className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-muted-foreground" />Credential secret name</label>
        <Input id="credential-reference" autoComplete="off" spellCheck={false} placeholder="NPREP_API_KEY" maxLength={256} value={reference} onChange={(event) => { setReference(event.target.value); setSaved(false); setError(""); }} aria-describedby="credential-help" />
        <p id="credential-help" className="text-sm text-muted-foreground">Enter only the name of a server secret, never its value. Do not enter an OTP, account password, or student access token.</p>
      </div>
      <section className="space-y-3 border-y border-border py-5">
        <h2 className="font-semibold">Credentials & approval</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Provider approval</dt><dd className="mt-1 font-medium">Not verified</dd></div>
          <div><dt className="text-muted-foreground">Server credentials</dt><dd className="mt-1 font-medium">Not connected</dd></div>
        </dl>
        <p className="text-sm text-muted-foreground">After NPrep approves this website, store its issued credentials in Vercel’s environment variables. The approved authentication method must be connected separately; this screen does not send or check credentials.</p>
      </section>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p role="status" className="text-sm text-primary">Draft saved for this tab only. Access remains unapproved; refreshing clears the draft.</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit"><Save />Save draft</Button>
        <Button type="button" variant="outline" onClick={() => { clearNprepConfigurationDraft(); setReference(""); setSaved(false); setError(""); }}><Trash2 />Clear draft</Button>
      </div>
    </form>
  </div>;
}