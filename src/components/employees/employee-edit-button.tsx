"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";

export function EmployeeEditButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" /> Ubah data
      </Button>
      <EmployeeFormDialog
        open={open}
        onOpenChange={setOpen}
        mode="edit"
        employeeId={employeeId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
