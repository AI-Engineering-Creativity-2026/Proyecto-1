import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

vi.mock("../index", () => ({
  init: vi.fn<() => void>(),
  destroy: vi.fn<() => void>(),
}));

import DemoRouter from "../components/DemoRouter.vue";
import FilmCarousel from "../components/FilmCarousel.vue";
import { init } from "../index";

afterEach(() => {
  window.location.hash = "";
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Landing, FilmCarousel and ChatPage routes", () => {
  it("renders landing sections, 8+ films, TMDB & Google Books attributions, and zero Mook/21.04", () => {
    const wrapper = mount(DemoRouter, {
      props: { apiUrl: "ws://mock.example/ws" },
    });

    const text = wrapper.text();
    expect(text).toContain("Selma");
    expect(text).toContain("Cómo funciona");
    expect(text).toContain("Películas");
    expect(text).toContain("Probar a Selma");
    expect(text).toContain("Si te gustó la película, descubre el libro.");
    expect(text).toContain("Hablar con Selma");
    expect(text).toContain("This product uses the TMDB API but is not endorsed or certified by TMDB.");
    expect(text).toContain("Powered by Google Books");
    expect(text).toContain("CC3116");
    expect(text).not.toMatch(/mook|21\.04/i);
    expect(wrapper.findAll(".film-slide").length).toBeGreaterThanOrEqual(8);
  });

  it("supports carousel next, prev, dots, keyboard navigation and pause toggle", async () => {
    vi.useFakeTimers();
    const wrapper = mount(FilmCarousel);

    const track = wrapper.get(".landing-carousel__track");
    expect(track.attributes("style")).toContain("translate3d(-0%");

    await wrapper.get('[aria-label="Siguiente película"]').trigger("click");
    expect(track.attributes("style")).toContain("translate3d(-100%");

    await wrapper.get('[aria-label="Película anterior"]').trigger("click");
    expect(track.attributes("style")).toContain("translate3d(-0%");

    await wrapper.get(".landing-carousel").trigger("keydown", { key: "ArrowRight" });
    expect(track.attributes("style")).toContain("translate3d(-100%");

    const dots = wrapper.findAll(".carousel-dot");
    await dots[2]!.trigger("click");
    expect(track.attributes("style")).toContain("translate3d(-200%");

    const pauseBtn = wrapper.get(".carousel-btn--pause");
    expect(pauseBtn.attributes("aria-pressed")).toBe("false");
    await pauseBtn.trigger("click");
    expect(pauseBtn.attributes("aria-pressed")).toBe("true");

    await vi.advanceTimersByTimeAsync(9000);
    expect(track.attributes("style")).toContain("translate3d(-200%");

    // Resume, hover pause, touch swipe, and image error fallback
    await pauseBtn.trigger("click");
    await wrapper.get(".landing-carousel").trigger("mouseenter");
    await vi.advanceTimersByTimeAsync(5000);
    expect(track.attributes("style")).toContain("translate3d(-200%");
    await wrapper.get(".landing-carousel").trigger("mouseleave");

    await wrapper.get(".landing-carousel").trigger("touchstart", { touches: [{ clientX: 200 }] });
    await wrapper.get(".landing-carousel").trigger("touchend", { changedTouches: [{ clientX: 100 }] });
    expect(track.attributes("style")).toContain("translate3d(-300%");

    await wrapper.get(".landing-carousel").trigger("touchstart", { touches: [{ clientX: 100 }] });
    await wrapper.get(".landing-carousel").trigger("touchend", { changedTouches: [{ clientX: 200 }] });
    expect(track.attributes("style")).toContain("translate3d(-200%");

    await wrapper.find(".film-slide__poster img").trigger("error");
    expect(wrapper.find(".film-slide__placeholder").exists()).toBe(true);
    wrapper.unmount();
  });

  it("disables carousel autoplay when prefers-reduced-motion: reduce is active", async () => {
    vi.useFakeTimers();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi
      .fn<() => { matches: boolean }>()
      .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;

    try {
      const wrapper = mount(FilmCarousel);
      const track = wrapper.get(".landing-carousel__track");
      await vi.advanceTimersByTimeAsync(10_000);
      expect(track.attributes("style")).toContain("translate3d(-0%");
      wrapper.unmount();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("navigates from landing to #/chat, mounts dock widget, and chips dispatch agichat:send", async () => {
    const wrapper = mount(DemoRouter, {
      props: { apiUrl: "ws://mock.example/ws" },
    });

    await wrapper.get(".btn-primary").trigger("click");
    await nextTick();

    expect(window.location.hash).toBe("#/chat");
    expect(wrapper.text()).toContain("¿Qué vemos esta noche?");
    expect(wrapper.text()).toContain("Volver al inicio");
    expect(wrapper.text()).toContain("Datos de películas por TMDB · Libros por Google Books");
    expect(wrapper.text()).not.toMatch(/mook|21\.04/i);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        containerId: "selma-chat-dock",
        mode: "dock",
        assistantName: "Selma",
      }),
    );

    const dispatched: string[] = [];
    const listener = (event: Event) => {
      dispatched.push((event as CustomEvent<{ text: string }>).detail.text);
    };
    window.addEventListener("agichat:send", listener);

    const chips = wrapper.findAll(".hero-chip");
    expect(chips).toHaveLength(3);
    await chips[0]!.trigger("click");
    await chips[1]!.trigger("click");
    await chips[2]!.trigger("click");

    expect(dispatched).toEqual([
      "Recomiéndame ciencia ficción",
      "Compara Blade Runner con su libro",
      "¿Vale la pena ver Dune?",
    ]);

    await wrapper.get(".chat-page__back").trigger("click");
    await nextTick();
    expect(window.location.hash).toBe("#/");

    await wrapper.get(".landing-nav__cta").trigger("click");
    await nextTick();
    expect(window.location.hash).toBe("#/chat");

    window.removeEventListener("agichat:send", listener);
    wrapper.unmount();
  });
});
