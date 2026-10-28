"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Progressive enhancement: applies smooth GSAP entrance & scroll-reveal animations
 * across all pages, cards, headers, and interactive elements while preserving full visibility
 * if JS or animation loading fails.
 */
export function MotionEnhancer() {
  const pathname = usePathname();
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          const main = document.getElementById("main");
          if (!main) return;

          const ctx = gsap.context(() => {
            // 1. Explicit [data-intro] elements + Page Titles
            const intros = main.querySelectorAll<HTMLElement>(
              "[data-intro], .nq-page-title"
            );
            if (intros.length > 0) {
              gsap.from(intros, {
                y: 20,
                opacity: 0,
                duration: 0.65,
                stagger: 0.07,
                ease: "power3.out",
                clearProps: "transform,opacity",
              });
            }

            // 2. Automatic staggered entrance for visible Cards & Panels on route change
            const autoCards = Array.from(
              main.querySelectorAll<HTMLElement>(
                ".nq-card, .nq-card-3d, .glass-panel, article"
              )
            ).filter(
              (el) =>
                !el.hasAttribute("data-intro") &&
                !el.hasAttribute("data-reveal") &&
                !el.closest("[role='menu']") &&
                !el.closest("[role='dialog']")
            );

            if (autoCards.length > 0) {
              const viewportHeight = window.innerHeight || 800;
              const aboveFold: HTMLElement[] = [];
              const belowFold: HTMLElement[] = [];

              autoCards.forEach((card) => {
                const rect = card.getBoundingClientRect();
                if (rect.top < viewportHeight * 0.95) {
                  aboveFold.push(card);
                } else {
                  belowFold.push(card);
                }
              });

              if (aboveFold.length > 0) {
                gsap.from(aboveFold.slice(0, 14), {
                  y: 18,
                  scale: 0.985,
                  opacity: 0,
                  duration: 0.52,
                  stagger: 0.055,
                  ease: "power3.out",
                  clearProps: "transform,opacity,scale",
                });
              }

              belowFold.forEach((el) => {
                gsap.from(el, {
                  y: 22,
                  opacity: 0,
                  duration: 0.58,
                  ease: "power2.out",
                  clearProps: "transform,opacity",
                  scrollTrigger: {
                    trigger: el,
                    start: "top 93%",
                    once: true,
                  },
                });
              });
            }

            // 3. Explicit [data-reveal] elements
            const reveals = main.querySelectorAll<HTMLElement>("[data-reveal]");
            if (reveals.length > 0) {
              reveals.forEach((el) => {
                gsap.from(el, {
                  y: 22,
                  opacity: 0,
                  duration: 0.65,
                  ease: "power2.out",
                  clearProps: "transform,opacity",
                  scrollTrigger: { trigger: el, start: "top 94%", once: true },
                });
              });
            }
          }, main);

          return () => ctx.revert();
        });

        mm.add(
          "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
          () => {
            const listeners: Array<() => void> = [];
            const ctx = gsap.context(() => {
              gsap.utils
                .toArray<HTMLElement>("[data-parallax]")
                .forEach((el) =>
                  gsap.to(el, {
                    y: 28,
                    ease: "none",
                    scrollTrigger: {
                      trigger: el,
                      start: "top top",
                      end: "bottom top",
                      scrub: 1,
                    },
                  })
                );

              document
                .querySelectorAll<HTMLElement>("[data-magnetic], [data-tilt]")
                .forEach((el) => {
                  const magnetic = el.hasAttribute("data-magnetic");
                  const move = (event: PointerEvent) => {
                    const r = el.getBoundingClientRect();
                    const x = (event.clientX - r.left) / r.width - 0.5;
                    const y = (event.clientY - r.top) / r.height - 0.5;
                    gsap.to(
                      el,
                      magnetic
                        ? {
                            x: x * 7,
                            y: y * 7,
                            duration: 0.25,
                            overwrite: "auto",
                          }
                        : {
                            rotationX: -y * 3,
                            rotationY: x * 3,
                            transformPerspective: 900,
                            duration: 0.35,
                            overwrite: "auto",
                          }
                    );
                  };
                  const leave = () =>
                    gsap.to(el, {
                      x: 0,
                      y: 0,
                      rotationX: 0,
                      rotationY: 0,
                      duration: 0.55,
                      ease: "back.out(1.6)",
                      overwrite: "auto",
                      clearProps: "transform",
                    });
                  el.addEventListener("pointermove", move);
                  el.addEventListener("pointerleave", leave);
                  listeners.push(() => {
                    el.removeEventListener("pointermove", move);
                    el.removeEventListener("pointerleave", leave);
                    gsap.killTweensOf(el);
                    gsap.set(el, { clearProps: "transform" });
                  });
                });
            });
            return () => {
              listeners.forEach((fn) => fn());
              ctx.revert();
            };
          }
        );

        cleanup = () => mm.revert();
        ScrollTrigger.refresh();
      })
      .catch(() => {
        /* Animation is optional; the application remains usable. */
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [pathname]);

  return null;
}
