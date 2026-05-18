"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Users } from "lucide-react";

type Member = {
  id: string;
  role: string;
  name: string | null;
  email: string;
  joined_at: string | null;
};

type ApiList<T> = {
  data: T[];
};

const roleLabels: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "担当者",
  viewer: "閲覧",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Request failed"
    );
  }
  return payload as T;
}

export default function TeamMembersClient() {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await fetchJson<ApiList<Member>>("/api/members");
      setMembers(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function addMember() {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await fetchJson("/api/members", {
        method: "POST",
        body: JSON.stringify({ name, email, role }),
      });
      setMessage("担当者を登録しました");
      setName("");
      setEmail("");
      setRole("member");
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMember(member: Member) {
    if (!window.confirm(`${member.name ?? member.email} を削除しますか。`)) {
      return;
    }
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/members/${member.id}`, { method: "DELETE" });
      setMessage("担当者を削除しました");
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="border border-[#d9ded3] bg-white p-5">
        <div className="mb-5 flex items-center gap-3">
          <Users className="h-5 w-5 text-[#2f5d50]" />
          <h2 className="text-xl font-bold">担当者を追加</h2>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            名前
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            メール
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            権限
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] bg-white px-3"
            >
              <option value="member">担当者</option>
              <option value="admin">管理者</option>
              <option value="viewer">閲覧</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void addMember()}
            disabled={isSaving}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            登録する
          </button>
          {message ? (
            <p className="border border-[#cde5d5] bg-[#f1faf4] px-4 py-3 text-sm font-semibold text-[#24613f]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="border border-[#d9ded3] bg-white">
        <div className="border-b border-[#e5e9df] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
            Members
          </p>
          <h2 className="mt-1 text-xl font-bold">登録済み担当者</h2>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm text-[#5f6b5f]">
              読み込み中
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-[#e1e6dc] p-4"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold">
                      {member.name ?? member.email}
                    </p>
                    <p className="mt-1 break-words text-xs text-[#6b7280]">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                      {roleLabels[member.role] ?? member.role}
                    </span>
                    {member.role !== "owner" ? (
                      <button
                        type="button"
                        onClick={() => void deleteMember(member)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-[#f1c9c3] px-3 text-sm font-bold text-[#9a3412]"
                      >
                        <Trash2 className="h-4 w-4" />
                        削除
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
