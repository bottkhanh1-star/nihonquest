"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { IconCompass, IconArrow, IconDash, IconArrowUR, IconUser } from "./LandingArt";

export function LandingHeaderActions() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (mounted && status === "authenticated" && session?.user) {
    return (
      <div className="hp-actions">
        <Link href="/app" className="hp-btn hp-btn--primary hp-btn--sm">
          Vào ứng dụng →
        </Link>
      </div>
    );
  }

  return (
    <div className="hp-actions">
      <Link href="/login" className="hp-btn hp-btn--ghost hp-btn--sm">
        Đăng nhập
      </Link>
      <Link href="/register" className="hp-btn hp-btn--primary hp-btn--sm">
        <IconUser />
        Tạo tài khoản
      </Link>
    </div>
  );
}

export function LandingHeroCta() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (mounted && status === "authenticated" && session?.user) {
    return (
      <div className="hp-cta">
        <Link href="/app" className="hp-btn hp-btn--primary">
          <span className="hp-btn__dot"><IconCompass /></span>
          Tiếp tục hành trình học
          <IconArrow />
        </Link>
      </div>
    );
  }

  return (
    <div className="hp-cta">
      <Link href="/register" className="hp-btn hp-btn--primary">
        <span className="hp-btn__dot"><IconCompass /></span>
        Bắt đầu hành trình miễn phí
        <IconArrow />
      </Link>
      <Link href="/app" className="hp-btn hp-btn--ghost">
        <IconDash />
        Vào Dashboard ứng dụng
        <IconArrowUR />
      </Link>
    </div>
  );
}
