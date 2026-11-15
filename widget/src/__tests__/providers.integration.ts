import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";

import type { Message } from "@agichat/core";
import MessageBubble from "../components/MessageBubble.vue";

function createMessage(providers?: Message["providers"]): Message {
  return {
    id: "provider-message",
    role: "agent",
    content: "Here are some recommendations.",
    timestamp: "2026-09-22T12:00:00.000Z",
    ...(providers === undefined ? {} : { providers }),
  };
}

describe("provider attribution", () => {
  it("shows the approved TMDB logo and exact attribution notice", () => {
    const wrapper = mount(MessageBubble, {
      props: { message: createMessage(["tmdb"]) },
    });

    const tmdbAttribution = wrapper.get(".provider-attribution--tmdb");
    const logo = tmdbAttribution.get("img");

    expect(logo.attributes("src")).toContain("themoviedb.org/assets/");
    expect(logo.attributes("alt")).toBe("The Movie Database (TMDB) logo");
    expect(tmdbAttribution.text()).toContain(
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    );
    expect(tmdbAttribution.get("a").attributes("href")).toBe(
      "https://www.themoviedb.org/",
    );
  });

  it("shows the Powered by Google logo beside a prominent Google Books link", () => {
    const wrapper = mount(MessageBubble, {
      props: { message: createMessage(["google_books"]) },
    });

    const attribution = wrapper.get(".provider-attribution--google_books");

    expect(attribution.get("img").attributes()).toMatchObject({
      src: "https://books.google.com/googlebooks/images/poweredby.png",
      alt: "Powered by Google",
    });
    expect(attribution.get('a[href="https://books.google.com/"]').text()).toBe(
      "Google Books",
    );
  });

  it("shows only attributions present in the agent message providers", () => {
    const wrapper = mount(MessageBubble, {
      props: { message: createMessage(["tmdb", "google_books"]) },
    });

    expect(wrapper.findAll(".provider-attribution")).toHaveLength(2);

    const noProviderWrapper = mount(MessageBubble, {
      props: { message: createMessage() },
    });
    expect(noProviderWrapper.find(".provider-attributions").exists()).toBe(false);
  });
});
