"use client";

import { Button, controlClass, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type Org = {
  departments: { id: string; name: string; parentId?: string | null; feishuDepartmentId?: string | null; children: { id: string; name: string }[] }[];
  teams: { id: string; name: string; department?: { name: string } | null; members: { userId: string }[] }[];
  members: { user: { id: string; name: string; email: string }; role: string; department: string | null }[];
};

export default function TeamsPage() {
  const toast = useSession((state) => state.toast);
  const queryClient = useQueryClient();
  const org = useQuery({ queryKey: ["org"], queryFn: () => api<Org>("/org") });
  const role = useSession((state) => state.role);
  const admin = role === "ADMIN" || role === "SUPER_ADMIN";
  const [department, setDepartment] = useState("");
  const [team, setTeam] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["org"] });
  async function remove(kind: "departments" | "teams", id: string, name: string) {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await api(`/${kind}/${id}`, { method: "DELETE" });
      await refresh();
      toast(`${name} removed`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not remove", "err");
    }
  }
  const addDepartment = useMutation({
    mutationFn: () => api("/departments", { method: "POST", body: JSON.stringify({ name: department }) }),
    onSuccess: async () => { setDepartment(""); await refresh(); toast("Department added"); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not add department", "err"),
  });
  const addTeam = useMutation({
    mutationFn: () => api("/teams", { method: "POST", body: JSON.stringify({ name: team, memberIds, departmentId: departmentId || undefined }) }),
    onSuccess: async () => { setTeam(""); setMemberIds([]); setDepartmentId(""); await refresh(); toast("Team added"); },
    onError: (error) => toast(error instanceof Error ? error.message : "Could not add team", "err"),
  });

  return (
    <div>
      <PageTitle title="Teams" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="font-medium">Departments</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(org.data?.departments ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f6f7f9] px-3 py-2">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-[#8b919a]">{item.feishuDepartmentId ? `Feishu ${item.feishuDepartmentId}` : "Local department"} · {item.children.length} child teams/units</div>
                </div>
                {admin ? <button className="text-xs text-[#8b919a]" onClick={() => remove("departments", item.id, item.name)}>Remove</button> : null}
              </li>
            ))}
          </ul>
          {admin ? <div className="mt-4 flex gap-2">
            <input className={controlClass} placeholder="New department" value={department} onChange={(event) => setDepartment(event.target.value)} />
            <Button onClick={() => addDepartment.mutate()} disabled={!department}>Add</Button>
          </div> : null}
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="font-medium">Teams</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(org.data?.teams ?? []).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f6f7f9] px-3 py-2">
                <span>{item.name} · {item.department?.name ?? "No department"} · {item.members.length} people</span>
                {admin ? <button className="text-xs text-[#8b919a]" onClick={() => remove("teams", item.id, item.name)}>Remove</button> : null}
              </li>
            ))}
          </ul>
          {admin ? <div className="mt-4 space-y-2">
            <input className={controlClass} placeholder="New team" value={team} onChange={(event) => setTeam(event.target.value)} />
            <select className={controlClass} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">No department</option>
              {(org.data?.departments ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-2 text-sm">
              {(org.data?.members ?? []).map((member) => (
                <label key={member.user.id} className="rounded-full bg-[#f6f7f9] px-3 py-1">
                  <input type="checkbox" className="mr-1" checked={memberIds.includes(member.user.id)} onChange={(event) => setMemberIds(event.target.checked ? [...memberIds, member.user.id] : memberIds.filter((id) => id !== member.user.id))} />
                  {member.user.name}
                </label>
              ))}
            </div>
            <Button onClick={() => addTeam.mutate()} disabled={!team}>Create team</Button>
          </div> : null}
        </section>
      </div>
      <section className="mt-4 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-medium">Directory</h2>
        <div className="mt-3 divide-y divide-[#f4f6f9] text-sm">
          {(org.data?.members ?? []).map((member) => (
            <div key={member.user.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div><div className="font-medium">{member.user.name}</div><div className="text-[#8b919a]">{member.user.email}</div></div>
              <div className="text-[#66707c]">{member.role} · {member.department ?? "No department"}</div>
            </div>
          ))}
        </div>
      </section>
      </div>
  );
}
