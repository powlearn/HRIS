"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCUMENT_TYPES } from "@/lib/design";

export function DocumentUploadDialog({
  employees,
  defaultEmployeeId,
}: {
  employees: { id: string; name: string; employeeCode: string }[];
  defaultEmployeeId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [employeeId, setEmployeeId] = React.useState(defaultEmployeeId ?? employees[0]?.id ?? "");
  const [type, setType] = React.useState("KONTRAK");
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || !employeeId) {
      toast.error("Pilih karyawan dan berkas yang akan diunggah.");
      return;
    }
    setPending(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("employeeId", employeeId);
      body.set("type", type);
      body.set("name", name);
      const res = await fetch("/api/v1/documents", { method: "POST", body });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal mengunggah dokumen.");
        return;
      }
      toast.success("Dokumen berhasil diunggah.");
      setOpen(false);
      setFile(null);
      setName("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Upload className="size-3.5" /> Unggah dokumen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unggah dokumen karyawan</DialogTitle>
            <DialogDescription>PDF, PNG, atau JPEG maksimal 5 MB. Berkas disimpan privat dan hanya dapat diunduh pengguna berizin.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label>Karyawan</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Pilih karyawan" /></SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} · {employee.employeeCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Jenis dokumen</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="docName">Nama dokumen</Label>
                <Input id="docName" value={name} onChange={(event) => setName(event.target.value)} placeholder="Opsional" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="file">Berkas</Label>
              <label
                htmlFor="file"
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-input bg-muted/30 px-4 py-6 text-center transition hover:border-ring/50 hover:bg-muted/50"
              >
                <FileUp className="size-5 text-muted-foreground" />
                <span className="text-[12px] font-medium">{file ? file.name : "Pilih berkas untuk diunggah"}</span>
                <span className="text-[10px] text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)} KB` : "PDF / PNG / JPEG · maks. 5 MB"}</span>
                <input
                  id="file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
              <Button type="submit" disabled={pending || !file}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Unggah
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function remove() {
    if (!window.confirm("Hapus dokumen ini? Tindakan ini tidak dapat dibatalkan.")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/v1/documents/${documentId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Gagal menghapus dokumen.");
        return;
      }
      toast.success("Dokumen dihapus.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={remove} disabled={pending} aria-label="Hapus dokumen" className="text-muted-foreground hover:text-destructive">
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
