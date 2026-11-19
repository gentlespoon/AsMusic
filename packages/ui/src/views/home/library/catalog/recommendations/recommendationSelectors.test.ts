import { describe, expect, it } from "vitest";
import type { Child } from "subsonic-api";
import type { SongListEntry } from "../SongListView";
import { selectMostPlayedSongEntries, selectNewestSongEntries, selectRecentlyPlayedSongEntries } from "./recommendationSelectors";

function entry(id: string, created: string, playCount = 0, played?: string): SongListEntry {
  const song = {
    id,
    title: id,
    created,
    playCount,
    played,
  } as Child;
  return {
    song,
    rowKey: id,
    serverId: "server",
    artworkScope: { serverKey: "server", libraryId: "lib" },
  } as SongListEntry;
}

describe("recommendation selectors", () => {
  const songs = [
    entry("old", "2020-01-01T00:00:00.000Z", 1),
    entry("new", "2024-01-01T00:00:00.000Z", 2, "2024-06-01T00:00:00.000Z"),
    entry("mid", "2022-01-01T00:00:00.000Z", 9, "2023-01-01T00:00:00.000Z"),
    entry("unplayed-new", "2025-01-01T00:00:00.000Z", 0),
  ];

  it("keeps the newest songs without requiring the rest of the catalog order", () => {
    expect(selectNewestSongEntries(songs, 2).map((row) => row.song.id)).toEqual([
      "unplayed-new",
      "new",
    ]);
  });

  it("keeps the most played songs", () => {
    expect(selectMostPlayedSongEntries(songs, 2).map((row) => row.song.id)).toEqual(["mid", "new"]);
  });

  it("skips songs that have never been played", () => {
    expect(selectRecentlyPlayedSongEntries(songs, 2).map((row) => row.song.id)).toEqual(["new", "mid"]);
  });
});
