const clock = (secs) => {
  const m = Math.floor(secs / 60),
    s = Math.floor(secs % 60);
  return m + ":" + String(s).padStart(2, "0");
};

const roughly = (secs) => {
  const m = Math.round(secs / 60);
  if (m < 2) return "about a minute";
  if (m < 60) return "about " + m + " minutes";
  const h = Math.round(m / 6) / 10;
  return "about " + h + " hours";
};

const andList = (names) => (names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]);

export function chronicle(s) {
  const first = s.slain.filter((b) => b.id !== "nyarl"),
    party = s.party ?? [];
  return [
    [
      ["nyarl is dead.", "m"],
      "",
      "and so they defeated that thing",
      "",
      "dead, on b" + s.depth + ", at the hands of one dungeoneer.",
    ],
    [
      ["the chronicle", "m"],
      "",
      "floors descended: " + s.depth,
      "foes slain: " + s.kills,
      "gold hoarded: " + s.gold,
      "level reached: " + s.lv,
      "time below: " + clock(s.time),
    ],
    [
      "and so they vanished...",
      "",
      "with nothing but a",
      "",
      "very unfinished game",
    ],
    party.length
      ? [andList(party) + " asked what happens next.", "", "nobody knew.", ""]
      : ["there was nobody to ask what happens next.", "", "so nobody asked."],
    [["and then they went home.", "w"]],
    ["they drank beers after"],
  ];
}
