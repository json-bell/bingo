// disney-2026's raw event pool -- the TS-array replacement for the old
// CSV+characters.ts pipeline (docs/grid-content-pipeline.md §1). Content
// originally converted from data/archive/disney-2026/draft-ideas.md, since
// evolved a lot further (real difficulties, variantGroups, guaranteed
// items). Anything not yet finalized is a real placeholder value flagged
// with a trailing comment, not left blank or null, so this file
// type-checks as-is and can be used to unit-test makeGrid's pool-building
// logic before real content is ready (docs/grid-content-pipeline.md §10):
//   - summary: "?? <word or two>", // TODO  -- needs a real short title
//   - difficulty: "e", // PLACEHOLDER - CHANGE        -- not yet difficulty-tagged
// A difficulty with no trailing comment was an explicit tag in the original
// draft (e.g. "(hard)"), not a guess. Placeholder difficulties are spread
// roughly evenly across e/m/h (not all defaulted to "e") so there's enough
// of each to actually build a test grid (8 per difficulty,
// docs/grid-content-pipeline.md §7) -- the specific e/m/h split per
// placeholder is arbitrary, not a real judgment, same as the summary
// placeholders.
//
// Consumed by data/disney-2026/generateGrids.ts, its own pipeline --
// deliberately NOT wired into the old createGrids.ts/getGrids.ts
// (europapark-2024's archived CSV pipeline). DisneyEvent below is
// deliberately its own type, not merged into types/trip.ts's
// BingoItem/GridCell, which getGrids.ts still consumes unchanged for
// europapark-2024 -- see docs/grid-content-pipeline.md §2 for why.

import type { Difficulty } from "../../types/trip";
import type { Person } from "./people";
import type { DisneySeedingInputs } from "./seedingInputs";
import { VariantGroup, type VariantGroupId } from "./variantGroups";

type EventDifficulty = Exclude<Difficulty, "f">;

export interface DisneyEvent {
  summary: string | ((inputs: DisneySeedingInputs) => string);
  description: string | ((inputs: DisneySeedingInputs) => string);
  difficulty: EventDifficulty;
  guaranteed?: boolean;
  eligiblePeople?: Person[];
  variantGroup?: VariantGroupId;
}

export const events: DisneyEvent[] = [
  {
    summary: "Let me break it down for you", // TODO
    description: "A ride breaks down while we're on it",
    difficulty: "m",
    variantGroup: VariantGroup.RIDE_BREAKDOWN
  },
  {
    summary: "?? ride breakdown queue", // TODO
    description: "A ride breaks down while we're queuing for it",
    difficulty: "m", // easy?
    variantGroup: VariantGroup.RIDE_BREAKDOWN
  },
  {
    summary: "Nap time",
    description: "someone falls asleep during a show",
    difficulty: "m"
  },
  {
    summary: "?? shooter high score", // TODO
    description: "You're highest scorer on a shooter",
    difficulty: "h"
  },
  {
    summary: "Still got it",
    description: "Ben gets galactic hero on buzz (or anyone else)",
    difficulty: "h",
    variantGroup: VariantGroup.SHOOTER
  },
  {
    summary: "Never had it",
    description:
      "Someone misunderstands a shooting ride in major way (wrong targets, wrong trigger, …)",
    difficulty: "h",
    variantGroup: VariantGroup.SHOOTER
  },
  {
    summary: "It's your birthday!",
    description: "We get something free because of birthday fraud",
    difficulty: "e"
  },
  {
    summary: "You're wet",
    description: "be wettest after a water ride",
    difficulty: "h"
  },
  {
    summary: "?? flight delayed", // TODO
    description: "Your flight gets delayed (> 20 mins)",
    difficulty: "m",
    variantGroup: VariantGroup.FLIGHT_TIMING
  },
  {
    summary: "Ka-Chow",
    description: "Your flight's on time (< 20 mins delay)",
    difficulty: "e",
    variantGroup: VariantGroup.FLIGHT_TIMING
  },
  {
    summary: "?? transport nap", // TODO
    description:
      "Someone falls asleep on transport to/from the parks (no photo no proof)",
    difficulty: "e"
  },
  {
    summary: "Late night wander",
    description:
      "We lose someone during fireworks (<=2 people unintentionally split)",
    difficulty: "m",
    variantGroup: VariantGroup.LOST
  },
  {
    summary: "Lost at sea",
    description: "Lose someone in a water park",
    difficulty: "m",
    variantGroup: VariantGroup.LOST
  },
  {
    summary: "Big Spender",
    description: "Someone spends more than $100 on merch",
    difficulty: "m",
    variantGroup: VariantGroup.MERCH
  },
  {
    summary: "Early Bird",
    description: "Someone buys merch on the 1st day (easy bc of bands)",
    difficulty: "e",
    variantGroup: VariantGroup.MERCH
  },
  {
    summary: "Photographer",
    description: "Someone asks us to take their picture",
    difficulty: "e"
  },
  {
    summary: "Mike Wasowski'd",
    description: "Your face gets blocked in a ride photo (>50%)",
    difficulty: "m"
  },
  {
    summary: "Apes together strong",
    description: "Planned group photo pose goes successfully",
    difficulty: "e"
  },
  {
    summary: "Stay hydrated",
    description: "You have more than 5 refills in one day",
    difficulty: "m",
    eligiblePeople: ["Maria", "Ben", "Jason", "Ciara"]
  },
  {
    summary: "We're Athletes",
    description: "Someone asks us about our quadball T shirts",
    difficulty: "m"
  },
  {
    summary: "We're Famous",
    description: "Someone recognises our group Disney bounding",
    difficulty: "h"
  },
  {
    summary: "This is my jam",
    description: (inputs) => `We get ${inputs.song} on Guardians of the Galaxy`,
    difficulty: "h",
    guaranteed: true
  },
  {
    summary: (inputs) => `${inputs.drinker}'s tipsy`,
    description: (inputs) =>
      `${inputs.drinker} does something that's clearly due to being tipsy/drunk`,
    difficulty: "h"
  },
  {
    summary: "Doppelganger",
    description: "We see a character that we are currently Disney bounding as",
    difficulty: "e"
  },
  {
    summary: "End of the world",
    description: "Deviate from the plan (we go to a park not planned)",
    difficulty: "h"
  },
  {
    summary: "?? show cancelled", // TODO
    description: "Show that we were going to see gets cancelled for weather",
    difficulty: "m"
  },
  {
    summary: "Rizzler",
    description: "Wave at a character and get a wave back",
    difficulty: "e"
  },
  {
    summary: "Master focus",
    description: "We go a whole day without talking about quadball",
    difficulty: "e"
  },
  {
    summary: (inputs) => `${inputs.shirtNumber} in the wild`,
    description: `Find something with your shirt number on it and take a picture`,
    difficulty: "h",
    guaranteed: true
  },
  {
    summary: "?? security confiscated", // TODO
    description: "Someone has something confiscated at security",
    difficulty: "h",
    variantGroup: VariantGroup.SECURITY_INCIDENT
  },
  {
    summary: "?? security pat down", // TODO
    description: "Someone gets a pat down at security",
    difficulty: "m",
    variantGroup: VariantGroup.SECURITY_INCIDENT
  },
  {
    summary: "?? security slowdown", // TODO
    description: "Someone's stuff slows us down going through park security",
    difficulty: "m"
  },
  {
    summary: "Meatball-less",
    description: "Day with no rain",
    difficulty: "h"
  },
  {
    summary: "OU𐞥C",
    description: "Someone gets queue jumped",
    difficulty: "m"
  },
  {
    summary: "Blister?",
    description: "Someone gets a blister",
    difficulty: "m"
  },
  {
    summary: "?? crying photo", // TODO
    description: "Someone's crying in a ride photo",
    difficulty: "h"
  },
  {
    summary: "Trip'd up",
    description: "We see someone faceplant",
    difficulty: "e",
    variantGroup: VariantGroup.FALL
  },
  {
    summary: "Banana'd",
    description: "We see someone banana peel fall",
    difficulty: "m",
    variantGroup: VariantGroup.FALL
  },
  {
    summary: "Family Feud",
    description: "We see a family arguing",
    difficulty: "e"
  },
  {
    summary: "Dis-knee Slapper",
    description:
      "Make a meme about the trip/with a photo from the trip which someone laughs out loud to when they first see it",
    difficulty: "m",
    guaranteed: true
  },
  {
    summary: "?? miss rope drop", // TODO
    description: "We miss rope drop",
    difficulty: "h"
  },
  {
    summary: "Bad Smuggler",
    description: "Someone's a terrible pilot on smugglers run",
    difficulty: "h"
  },
  {
    summary: "?? open to close", // TODO
    description: "We're in the park from open till close (3 days)",
    difficulty: "e"
  },
  {
    summary: "Y'all British?",
    description:
      "Someone mentions that's we're British or says that they love our accent?",
    difficulty: "m"
  },
  {
    summary: "?? forgot swimsuit", // TODO
    description: "Someone forgets their swimsuit",
    difficulty: "h",
    variantGroup: VariantGroup.FORGOT
  },
  {
    summary: "?? forgot jersey", // TODO
    description: "Someone forgets their Jersey",
    difficulty: "h",
    variantGroup: VariantGroup.FORGOT
  },
  {
    summary: "Hidden Mickey",
    description: "You find a verified Hidden Mickey",
    difficulty: "e"
  },
  {
    summary: "Worth it",
    description: "Someone's quick service meal snack points is valued over $30",
    difficulty: "e"
  },
  {
    summary: "Walk-on",
    description:
      "Less than 3 mins from entering the queue to getting onto the ride",
    difficulty: "e"
  }
];
