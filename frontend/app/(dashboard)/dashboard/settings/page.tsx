"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    api
      .get("/api/settings/access/visible-sections")
      .then((visible) => {
        if (visible.system) router.replace("/dashboard/settings/system");
        else if (visible.technical) router.replace("/dashboard/settings/technical");
        else if (visible.defaults) router.replace("/dashboard/settings/defaults");
        else if (visible.access_rights) router.replace("/dashboard/settings/access");
        else if (visible.modules) router.replace("/dashboard/settings/modules");
        else router.replace("/dashboard");
      })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
      <div className="loading-spinner" style={{ width: 32, height: 32 }}></div>
    </div>
  );
}
