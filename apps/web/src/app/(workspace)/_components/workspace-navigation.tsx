"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";

import {
  TonePill,
  WorkspaceSidebar,
  type WorkspaceSidebarSection,
} from "@/components/workspace";
import type { SessionRole } from "@psms/shared";

type NavigationSection = Omit<WorkspaceSidebarSection, "items"> & {
  items: Array<
    WorkspaceSidebarSection["items"][number] & {
      roles?: SessionRole[];
    }
  >;
};

const rawNavSections: NavigationSection[] = [
  {
    title: "운영",
    items: [
      { label: "대시보드", href: "/" },
      { label: "판매 관리", href: "/sales", icon: ClipboardList },
      { label: "미수금 관리", href: "/receivables", icon: CreditCard },
      { label: "고객 관리", href: "/customers", icon: Users },
      { label: "일정 관리", href: "/schedule", icon: CalendarDays },
      { label: "재고 관리", href: "/inventory", icon: Boxes },
    ],
  },
  {
    title: "관리자",
    items: [
      {
        label: "직원 관리",
        href: "/staffs",
        icon: Users,
        badge: <TonePill className="hidden xl:inline-flex">ADMIN</TonePill>,
        roles: ["ADMIN"],
      },
      {
        label: "기초정보",
        href: "/settings/base",
        icon: Settings,
        badge: <TonePill className="hidden xl:inline-flex">ADMIN</TonePill>,
        roles: ["ADMIN"],
      },
      {
        label: "정책 관리",
        href: "/settings/policies",
        icon: ShieldCheck,
        badge: <TonePill className="hidden xl:inline-flex">ADMIN</TonePill>,
        roles: ["ADMIN"],
      },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type WorkspaceNavigationProps = {
  role: SessionRole;
  brand?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function WorkspaceNavigation({
  role,
  brand,
  footer,
  className,
}: WorkspaceNavigationProps) {
  const pathname = usePathname();
  const navSections = useMemo(
    () =>
      rawNavSections
        .map((section) => ({
          ...section,
          items: section.items
            .filter((item) => !item.roles || item.roles.includes(role))
            .map((item) => ({
              label: item.label,
              href: item.href,
              icon:
                item.href === "/"
                  ? LayoutDashboard
                  : item.href === "/reports/summary"
                    ? BarChart3
                    : item.icon,
              badge: item.badge,
              isActive: isActivePath(pathname, item.href),
            })),
        }))
        .filter((section) => section.items.length > 0),
    [pathname, role]
  );

  return (
    <WorkspaceSidebar
      sections={navSections}
      brand={brand}
      footer={footer}
      className={className}
    />
  );
}
