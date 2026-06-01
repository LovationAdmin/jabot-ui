import { useEffect, useState } from "react";
import { X, Send, Users, Copy, Check } from "lucide-react";
import { invitationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface InviteManagerProps {
  onClose: () => void;
}

interface InvitationItem {
  id: string;
  status: string;
  sms_sent: boolean;
  expires_at: string;
  created_at: string;
  validated_at: string | null;
}

export function InviteManager({ onClose }: InviteManagerProps) {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [list, setList] = useState<InvitationItem[]>([]);
  const [listLoading, setListLoading] = useState(true);

  useEffect(() => {
    invitationsApi.list()
      .then(setList)
      .catch(() => {/* 503 when feature off — ignore */})
      .finally(() => setListLoading(false));
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setSending(true);
    setSendError(null);
    setDevCode(null);
    setDevToken(null);
    try {
      const res = await invitationsApi.create(phone.trim());
      if (res.dev_code) {
        setDevCode(res.dev_code);
        setDevToken(res.token);
      }
      setPhone("");
      const updated = await invitationsApi.list();
      setList(updated);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? "Erreur lors de l'envoi.";
      if (detail.includes("pas encore activé")) {
        setSendError("Le système d'invitation n'est pas encore activé (Vonage en attente).");
      } else {
        setSendError(detail);
      }
    } finally {
      setSending(false);
    }
  }

  function copyLink() {
    if (!devToken) return;
    const url = `${window.location.origin}/invite?token=${devToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const statusLabel: Record<string, string> = {
    pending: "En attente",
    validated: "Validée",
    expired: "Expirée",
    revoked: "Révoquée",
  };
  const statusColor: Record<string, string> = {
    pending: "text-amber-600 bg-amber-50",
    validated: "text-green-600 bg-green-50",
    expired: "text-muted-foreground bg-muted",
    revoked: "text-destructive bg-destructive/10",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h2 className="font-semibold text-foreground">Inviter par SMS</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Envoyez une invitation à un proche via son numéro de téléphone. Il recevra un lien + un code SMS pour accéder à l'arbre.
        </p>

        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+33612345678"
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={sending || !phone.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="size-3.5" />
            {sending ? "…" : "Inviter"}
          </button>
        </form>

        {sendError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{sendError}</p>
        )}

        {devCode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">Mode dev — code non envoyé par SMS</p>
            <p className="mt-1 font-mono text-lg font-bold text-amber-900">{devCode}</p>
            {devToken && (
              <button
                onClick={copyLink}
                className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "Copié !" : "Copier le lien d'invitation"}
              </button>
            )}
          </div>
        )}

        {/* List */}
        <div className="max-h-52 overflow-y-auto">
          {listLoading ? (
            <p className="text-center text-xs text-muted-foreground">Chargement…</p>
          ) : list.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">Aucune invitation envoyée.</p>
          ) : (
            <ul className="space-y-1.5">
              {list.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(inv.created_at).toLocaleDateString("fr")}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", statusColor[inv.status] ?? "text-muted-foreground bg-muted")}>
                    {statusLabel[inv.status] ?? inv.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
