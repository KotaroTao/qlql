"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, Eye, Shield } from "lucide-react";
import { CTAAlert } from "@/components/dashboard/cta-alert";
import { Logo } from "@/components/logo";

interface Clinic {
  id: string;
  name: string;
  email: string;
  slug: string;
  status: string;
  subscription: {
    status: string;
    trialEnd: string | null;
  } | null;
}

interface SubscriptionInfo {
  isDemo?: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          setClinic(data.clinic);
          setIsImpersonating(!!data.isImpersonating);
          // サブスクリプション情報を取得
          const subResponse = await fetch("/api/billing/subscription");
          if (subResponse.ok) {
            const subData = await subResponse.json();
            setSubscription(subData.subscription);
          }
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    // 設定ページからの医院名変更を受け取る
    const handleSettingsUpdated = () => {
      fetch("/api/auth/me")
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data) setClinic(data.clinic); })
        .catch(() => {});
    };
    window.addEventListener("clinic-settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("clinic-settings-updated", handleSettingsUpdated);
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // キャッシュをクリアしてハードリダイレクト
    window.location.href = "/";
  };

  const handleBackToAdmin = async () => {
    // auth_tokenを削除してadmin_auth_tokenだけ残す
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/clinics";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  const navLinks = [
    { href: "/dashboard", label: "ダッシュボード" },
    { href: "/dashboard/channels/new", label: "QRコード作成" },
    { href: "/dashboard/diagnoses", label: "診断管理" },
    { href: "/dashboard/meetings", label: "議事録" },
    { href: "/dashboard/settings", label: "設定" },
    { href: "/dashboard/billing", label: "契約・お支払い" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center">
              <Logo size="lg" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {/* 医院名を常時表示 */}
            {clinic?.name && (
              <span className="text-sm text-gray-700 font-medium truncate max-w-[200px]">
                {clinic.name}
              </span>
            )}
            {/* ハンバーガーメニューボタン（全画面サイズで表示） */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              aria-label="メニュー"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* ハンバーガーメニュー（全画面サイズ対応） */}
        {mobileMenuOpen && (
          <div className="border-t bg-white">
            <nav className="container mx-auto px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-3 rounded-lg text-sm ${
                    pathname === link.href
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 mt-4 border-t">
                <div className="px-4 py-2 text-sm text-gray-500">
                  {clinic?.name}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  ログアウト
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* 管理者なりすましバナー */}
      {isImpersonating && (
        <div className="bg-amber-500 text-white">
          <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm">
            <Shield className="w-4 h-4" />
            <span className="font-medium">管理者モード</span>
            <span className="hidden sm:inline">- {clinic?.name} としてログイン中</span>
            <button
              onClick={handleBackToAdmin}
              className="ml-2 px-3 py-0.5 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
            >
              管理画面に戻る
            </button>
          </div>
        </div>
      )}

      {/* デモアカウントバナー */}
      {subscription?.isDemo && !isImpersonating && (
        <div className="bg-blue-600 text-white">
          <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm">
            <Eye className="w-4 h-4" />
            <span className="font-medium">デモアカウント</span>
            <span className="hidden sm:inline">- データの閲覧のみ可能です。QRコードや診断の作成・編集はできません。</span>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-4 sm:py-8">
        <CTAAlert />
        {children}
      </main>
    </div>
  );
}
