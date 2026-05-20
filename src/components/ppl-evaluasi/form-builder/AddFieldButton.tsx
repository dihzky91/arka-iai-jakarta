"use client";

import {
  AlignLeft,
  CheckSquare,
  CircleDot,
  Grid3X3,
  Hash,
  List,
  Mail,
  SlidersHorizontal,
  Type,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FieldType } from "./types";

const FIELD_TYPE_OPTIONS: {
  type: FieldType;
  label: string;
  icon: React.ReactNode;
  group: "basic" | "choice" | "advanced";
}[] = [
  { type: "text", label: "Teks Singkat", icon: <Type className="h-4 w-4" />, group: "basic" },
  { type: "textarea", label: "Teks Panjang", icon: <AlignLeft className="h-4 w-4" />, group: "basic" },
  { type: "number", label: "Angka", icon: <Hash className="h-4 w-4" />, group: "basic" },
  { type: "email", label: "Email", icon: <Mail className="h-4 w-4" />, group: "basic" },
  { type: "select", label: "Dropdown", icon: <List className="h-4 w-4" />, group: "choice" },
  { type: "radio", label: "Pilihan Tunggal", icon: <CircleDot className="h-4 w-4" />, group: "choice" },
  { type: "checkbox", label: "Pilihan Ganda", icon: <CheckSquare className="h-4 w-4" />, group: "choice" },
  { type: "scale", label: "Skala (Likert)", icon: <SlidersHorizontal className="h-4 w-4" />, group: "advanced" },
  { type: "grid", label: "Grid / Matriks", icon: <Grid3X3 className="h-4 w-4" />, group: "advanced" },
  { type: "narasumber_section", label: "Evaluasi Narasumber", icon: <Users className="h-4 w-4" />, group: "advanced" },
];

interface AddFieldButtonProps {
  onAdd: (type: FieldType) => void;
  disabled?: boolean;
}

export function AddFieldButton({ onAdd, disabled }: AddFieldButtonProps) {
  const basicFields = FIELD_TYPE_OPTIONS.filter((f) => f.group === "basic");
  const choiceFields = FIELD_TYPE_OPTIONS.filter((f) => f.group === "choice");
  const advancedFields = FIELD_TYPE_OPTIONS.filter((f) => f.group === "advanced");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Tambah Field
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Input Dasar</DropdownMenuLabel>
        <DropdownMenuGroup>
          {basicFields.map((field) => (
            <DropdownMenuItem key={field.type} onClick={() => onAdd(field.type)}>
              {field.icon}
              <span className="ml-2">{field.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Pilihan</DropdownMenuLabel>
        <DropdownMenuGroup>
          {choiceFields.map((field) => (
            <DropdownMenuItem key={field.type} onClick={() => onAdd(field.type)}>
              {field.icon}
              <span className="ml-2">{field.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Lanjutan</DropdownMenuLabel>
        <DropdownMenuGroup>
          {advancedFields.map((field) => (
            <DropdownMenuItem key={field.type} onClick={() => onAdd(field.type)}>
              {field.icon}
              <span className="ml-2">{field.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
