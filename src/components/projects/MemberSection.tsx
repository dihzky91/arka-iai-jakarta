"use client";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_MEMBER_ROLES, type ProjectMemberRole } from "@/lib/project-constants";
import {
  addProjectMembers,
  removeProjectMember,
  searchUsersForInvite,
  updateMemberRole,
  type InviteUserRow,
  type ProjectMemberRow,
} from "@/server/actions/projects";
import { Avatar } from "./ProjectAvatar";
import { EmptyText } from "./shared-ui";

export function MemberSection({
  projectId,
  members,
  canManage,
  actorRole,
  onRefresh,
  pending,
}: {
  projectId: string;
  members: ProjectMemberRow[];
  canManage: boolean;
  actorRole: ProjectMemberRole | "admin";
  onRefresh: () => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InviteUserRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [role, setRole] = useState<ProjectMemberRole>("member");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!canManage || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      startTransition(async () => {
        setResults(await searchUsersForInvite(query, projectId));
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [canManage, projectId, query]);

  function toggleUser(userId: string) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function addMembers() {
    startTransition(async () => {
      const result = await addProjectMembers(projectId, { userIds: selectedIds, role });
      if (result.ok) {
        setSelectedIds([]);
        setQuery("");
        setResults([]);
        toast.success("Anggota ditambahkan.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function changeRole(userId: string, nextRole: ProjectMemberRole) {
    startTransition(async () => {
      const result = await updateMemberRole(projectId, userId, nextRole);
      if (result.ok) {
        toast.success("Role anggota diperbarui.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(userId: string) {
    if (!window.confirm("Hapus anggota ini dari project?")) return;
    startTransition(async () => {
      const result = await removeProjectMember(projectId, userId);
      if (result.ok) {
        toast.success("Anggota dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const canEditRoles = actorRole === "admin" || actorRole === "owner";

  return (
    <section className="space-y-5 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      {canManage ? (
        <div className="space-y-3 rounded-xl border border-border/60 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama/email user"
            />
            <Select value={role} onValueChange={(value) => setRole(value as ProjectMemberRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_MEMBER_ROLES.filter((item) => item !== "owner" || canEditRoles).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || isPending || pending}
              onClick={addMembers}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Add
            </Button>
          </div>
          {results.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                >
                  <span>
                    <span className="block font-medium">{user.namaLengkap ?? user.email}</span>
                    <span className="text-muted-foreground">{user.divisiNama ?? "-"} - {user.email}</span>
                  </span>
                  {selectedIds.includes(user.id) ? <Plus className="h-4 w-4 rotate-45" /> : <Plus className="h-4 w-4" />}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.userId} className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={member.namaLengkap} avatarUrl={member.avatarUrl} />
              <div>
                <p className="font-medium">{member.namaLengkap ?? member.email}</p>
                <p className="text-sm text-muted-foreground">{member.divisiNama ?? "-"} - {member.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canEditRoles ? (
                <Select
                  value={member.role}
                  onValueChange={(value) => changeRole(member.userId, value as ProjectMemberRole)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_MEMBER_ROLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{member.role}</Badge>
              )}
              {canManage ? (
                <Button type="button" variant="destructive" size="icon-sm" onClick={() => remove(member.userId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {members.length === 0 ? (
          <EmptyText
            icon={Users}
            title="Belum ada anggota"
            text="Tambahkan anggota agar role, assignee task, dan kolaborasi project bisa dikelola."
          />
        ) : null}
      </div>
    </section>
  );
}
