import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
if (root.replaceAll("\\", "/").toLowerCase() !== "c:/users/mh/desktop/cmmsfinal") throw new Error("Unexpected workspace");
const purchasePath = "client/src/pages/purchase/CreatePurchaseOrder.tsx";
const panelPath = "client/src/pages/maintenance-teams/ExecutionPanel.tsx";
const pickerPath = "client/src/components/catalog/CatalogPickerDialog.tsx";
const artifacts = path.join(root, "tools/catalog-picker/artifacts");
if (fs.existsSync(path.join(root, pickerPath))) throw new Error("Shared picker already exists; refusing to overwrite");
fs.mkdirSync(artifacts, { recursive: true });
const manifest = [purchasePath, panelPath].map(file => {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const backup = path.join(artifacts, path.basename(file) + ".before");
  fs.writeFileSync(backup, text);
  return { file, backup, sha256: crypto.createHash("sha256").update(text).digest("hex") };
});
fs.writeFileSync(path.join(artifacts, "before.json"), JSON.stringify(manifest, null, 2));
const source = fs.readFileSync(path.join(root, purchasePath), "utf8");
const start = source.indexOf("// ── Catalog Item Picker Dialog");
const end = source.indexOf("// ── Add Item Choice Dialog", start);
if (start < 0 || end < start || source.indexOf("function CatalogPickerDialog(", start) >= end) throw new Error("Picker boundaries not found");
const original = source.slice(start, end).replaceAll("\r\n", "\n");
let picker = original.replace("function CatalogPickerDialog(", "export function CatalogPickerDialog(");
picker = picker.replace("  onSelect,\n}: {", "  onSelect,\n  requiredUnit,\n}: {");
picker = picker.replace("  open: boolean;\n", "  open: boolean;\n  /** Matching material needs keeps the existing exact-unit rule. */\n  requiredUnit?: string;\n");
picker = picker.replace("  const items = serverItems || [];", "  const items = (serverItems || []).filter((item: any) => requiredUnit === undefined || item.unit === requiredUnit);");
if (!picker.includes("requiredUnit,\n") || !picker.includes("requiredUnit?: string")) throw new Error("Required-unit adaptation failed");
const imports = [
  'import { trpc } from "@/lib/trpc";',
  'import { useTranslation } from "@/contexts/LanguageContext";',
  'import { cn } from "@/lib/utils";',
  'import { Input } from "@/components/ui/input";',
  'import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";',
  'import { BookOpen, Search, ChevronDown, ChevronRight, FolderOpen, Loader2 } from "lucide-react";',
  'import { useState, useMemo, useRef, useEffect } from "react";',
  'import { getLocalizedCatalogDescription, getLocalizedCatalogName, getLocalizedCatalogUnitName } from "@/i18n/catalogMasterData";',
].join("\n");
fs.writeFileSync(path.join(root, pickerPath), imports + "\n\n" + picker + '\nexport type CatalogPickerSelection = Parameters<Parameters<typeof CatalogPickerDialog>[0]["onSelect"]>[0];\n');
const replaced = (source.slice(0, start) + source.slice(end))
  .replace('import { trpc } from "@/lib/trpc";', 'import { trpc } from "@/lib/trpc";\nimport { CatalogPickerDialog } from "@/components/catalog/CatalogPickerDialog";')
  .replace("FilePlus, Search, ChevronDown, ChevronRight, FolderOpen, Save", "FilePlus, Save");
fs.writeFileSync(path.join(root, purchasePath), replaced);
fs.writeFileSync(path.join(artifacts, "picker-original.tsx.txt"), original);
console.log("Extracted the existing picker; purchase form selection logic is unchanged.");
