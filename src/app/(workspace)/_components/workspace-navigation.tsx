"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  TonePill,
  WorkspaceSidebar,
  type WorkspaceSidebarSection,
} from "@/components/workspace";
import type { SessionRole } from "@/types/auth";

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
      { label: "판매 관리", href: "/sales" },
      { label: "미수금 관리", href: "/receivables" },
      { label: "고객 관리", href: "/customers" },
      { label: "일정 관리", href: "/schedule" },
      { label: "재고 관리", href: "/inventory" },
    ],
  },
  {
    title: "관리자",
    items: [
      {
        label: "직원 관리",
        href: "/staffs",
        badge: <TonePill>ADMIN</TonePill>,
        roles: ["ADMIN"],
      },
      {
        label: "기초정보",
        href: "/settings/base",
        badge: <TonePill>ADMIN</TonePill>,
        roles: ["ADMIN"],
      },
      {
        label: "정책 관리",
        href: "/settings/policies",
        badge: <TonePill>ADMIN</TonePill>,
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
