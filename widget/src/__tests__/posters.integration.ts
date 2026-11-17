import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import type { Message } from "@agichat/core";
import MessageBubble from "../components/MessageBubble.vue";

function createPosterMessage(url: string, alt = "Test movie poster"): Message {
  return {
    id: "poster-message",
    role: "agent",
    content: "Recibí tu mensaje: **__poster__**",
    timestamp: "2026-09-22T12:00:00.000Z",
    attachments: [{
      type: "poster",
      url,
      alt,
      title: "Test movie",
    }],
  };
}

describe("MessageBubble posters", () => {
  it("renders the __poster__ fixture with accessible alt text", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: createPosterMessage(
          "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
          "Poster for Test movie",
        ),
      },
    });

    expect(wrapper.get(".poster-card img").attributes()).toMatchObject({
      src: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      alt: "Poster for Test movie",
      loading: "lazy",
      referrerpolicy: "no-referrer",
    });
    expect(wrapper.get(".poster-card figcaption").text()).toBe("Test movie");
  });

  it("does not render images from non-HTTPS or non-allowlisted URLs", () => {
    for (const url of [
      "http://image.tmdb.org/t/p/w500/poster.jpg",
      "https://image.tmdb.org.attacker.example/poster.jpg",
      "https://attacker.example/image.tmdb.org/poster.jpg",
      "https://user:password@image.tmdb.org/poster.jpg",
    ]) {
      const wrapper = mount(MessageBubble, {
        props: { message: createPosterMessage(url) },
      });

      expect(wrapper.find(".poster-card img").exists()).toBe(false);
      expect(wrapper.get(".poster-card__fallback").attributes("aria-label")).toContain(
        "Test movie poster",
      );
      expect(wrapper.get(".poster-card__fallback").text()).toContain("Póster no disponible");
      wrapper.unmount();
    }
  });

  it("shows the visual fallback when an allowlisted image fails to load", async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: createPosterMessage(
          "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        ),
      },
    });

    await wrapper.get(".poster-card img").trigger("error");

    expect(wrapper.find(".poster-card img").exists()).toBe(false);
    expect(wrapper.get(".poster-card__fallback").text()).toContain("Póster no disponible");
  });
});
