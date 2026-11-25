"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Eye, EyeOff, Save, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { guidedProjectOptions, guidedProjectPresets, type GuidedProjectOption } from "@/lib/guided-projects";

const CATEGORIES: GuidedProjectOption["category"][] = [
  "Impressão & Adesivos",
  "Placas, Fachadas & Estruturas",
  "Laser, CNC, Acrílico & 3D",
];

export function GuidedProjectsModal({
  disabledKinds,
  onClose,
  onSaved,
}: {
  disabledKinds: string[];
  onClose: () => void;
  onSaved: (nextDisabled: string[]) => void;
}) {
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set(disabledKinds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visibleCount = useMemo(
    () => guidedProjectOptions.filter((item) => !disabled.has(item.kind)).length,
    [disabled],
  );

  function toggleKind(kind: string) {
    setDisabled((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function applyPreset(enabledKinds: string[]) {
    const enabledSet = new Set(enabledKinds);
    setDisabled(new Set(guidedProjectOptions.filter((item) => !enabledSet.has(item.kind)).map((item) => item.kind)));
  }

  function toggleCategory(category: GuidedProjectOption["category"]) {
    const items = guidedProjectOptions.filter((item) => item.category === category);
    const allEnabled = items.every((item) => !disabled.has(item.kind));
    setDisabled((current) => {
      const next = new Set(current);
      for (const item of items) {
        if (allEnabled) next.add(item.kind);
        else next.delete(item.kind);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    const nextDisabled = guidedProjectOptions
      .filter((item) => disabled.has(item.kind))
      .map((item) => item.kind);
    try {
      const response = await fetch("/api/gestao/precificacao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "guidedProjects", disabledKinds: nextDisabled }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar as preferências.");
      onSaved(payload.disabledKinds ?? nextDisabled);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as preferências.");
      setSaving(false);
    }
  }

  return (
    <div
      className="workspace-modal guided-projects-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Personalizar projetos guiados"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="workspace-dialog guided-projects-dialog">
        <header className="form-title">
          <div>
            <b><SlidersHorizontal className="inline-icon" /> Personalizar projetos guiados</b>
            <small>Escolha quais projetos aparecem no seletor do orçamento para deixar o dia a dia mais enxuto.</small>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar personalização" onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="guided-modal-toolbar">
          <div className="guided-presets">
            <span><Sparkles /> Perfis rápidos:</span>
            {guidedProjectPresets.map((preset) => (
              <button key={preset.id} type="button" onClick={() => applyPreset(preset.enabled)}>
                {preset.label}
              </button>
            ))}
          </div>
          <span className="guided-count-badge">
            <Eye /> {visibleCount} de {guidedProjectOptions.length} visíveis
          </span>
        </div>

        <div className="guided-modal-groups">
          {CATEGORIES.map((category) => {
            const items = guidedProjectOptions.filter((item) => item.category === category);
            const activeInGroup = items.filter((item) => !disabled.has(item.kind)).length;
            return (
              <section key={category} className="guided-modal-group">
                <header>
                  <div>
                    <strong>{category}</strong>
                    <small>{activeInGroup}/{items.length} ativos</small>
                  </div>
                  <button type="button" onClick={() => toggleCategory(category)}>
                    {activeInGroup === items.length ? <><EyeOff /> Ocultar grupo</> : <><Eye /> Mostrar grupo</>}
                  </button>
                </header>
                <div className="guided-modal-grid">
                  {items.map((item) => {
                    const enabled = !disabled.has(item.kind);
                    return (
                      <label key={item.kind} className={`guided-option-card ${enabled ? "enabled" : "disabled"}`}>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleKind(item.kind)}
                        />
                        <span>
                          <b>{item.shortLabel}</b>
                          <small>{item.label}</small>
                        </span>
                        <em aria-hidden="true">{enabled ? <Check /> : <EyeOff />}</em>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <p className="guided-modal-note">
          <AlertTriangle />
          <span>Ocultar um projeto apenas remove a opção da lista de novos orçamentos. Propostas e OS antigas que já usaram esse tipo continuam funcionando normalmente.</span>
        </p>

        {error && <div className="module-feedback"><AlertTriangle />{error}</div>}

        <footer className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={saving}>
            <Save />
            {saving ? "Salvando..." : "Salvar preferências"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
