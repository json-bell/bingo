// disney-2026's raw event pool -- the TS-array replacement for the old
// CSV+characters.ts pipeline (docs/grid-content-pipeline.md §1). Content
// converted directly from draft-ideas.md (repo root). Anything not yet
// finalized is a real placeholder value flagged with a trailing comment,
// not left blank or null, so this file type-checks as-is and can be used to
// unit-test makeGrid's pool-building logic before real content is ready
// (docs/grid-content-pipeline.md §10):
//   - summary: "placeholder <word or two>", // TODO  -- needs a real short title
//   - difficulty: "e", // PLACEHOLDER - CHANGE        -- not yet difficulty-tagged
// A difficulty with no trailing comment was an explicit tag in draft-ideas.md
// (e.g. "(hard)"), not a guess.
//
// NOT YET wired into createGrids.ts/getGrids.ts -- teaching makeGrid() to
// consume guaranteed/eligiblePeople/variantGroup and to resolve
// function-valued summary/description via SeedingInputs is separate,
// not-yet-started work (temp-prompt.md item #2). DisneyEvent below is
// deliberately its own type for now, not merged into types/trip.ts's
// BingoItem/GridCell, which getGrids.ts still consumes unchanged for
// europapark-2024.

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
    summary: "placeholder ride breakdown", // TODO
    description: "A ride breaks down while we're on it",
    difficulty: "e", // PLACEHOLDER - CHANGE
    variantGroup: VariantGroup.RIDE_BREAKDOWN,
  },
  {
    summary: "placeholder ride breakdown queue", // TODO
    description: "A ride breaks down while we're queuing for it",
    difficulty: "e", // PLACEHOLDER - CHANGE
    variantGroup: VariantGroup.RIDE_BREAKDOWN,
  },
  {
    summary: "Nap time",
    description: "someone falls asleep during a show",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder shooter high score", // TODO
    description: "You're highest scorer on a shooter",
    difficulty: "h",
  },
  {
    summary: "Still got it",
    description: "Ben gets galactic hero on buzz (or anyone else)",
    difficulty: "h",
  },
  {
    summary: "Never had it",
    description:
      "Someone misunderstands a shooting ride in major way (wrong targets, wrong trigger, …)",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "It's your birthday!",
    description: "We get something free because of birthday fraud",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "You're wet",
    description: "be wettest after a water ride",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder flight delayed", // TODO
    description: "Your flight gets delayed (> 20 mins)",
    difficulty: "e", // PLACEHOLDER - CHANGE
    variantGroup: VariantGroup.FLIGHT_TIMING,
  },
  {
    summary: "placeholder flight on time", // TODO
    description: "Your flight's on time (< 20 mins delay)",
    difficulty: "e", // PLACEHOLDER - CHANGE
    variantGroup: VariantGroup.FLIGHT_TIMING,
  },
  {
    summary: "placeholder transport nap", // TODO
    description: "Someone falls asleep on transport to/from the parks (no photo no proof)",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Late night wander",
    description: "We lose someone during fireworks",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Lost at sea",
    description: "Lose someone in a water park",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Big Spender",
    description: "Someone spends more than $100 on merch",
    difficulty: "e", // PLACEHOLDER - CHANGE
    variantGroup: VariantGroup.MERCH,
  },
  {
    summary: "placeholder merch day one", // TODO
    description: "Someone buys merch on the 1st day (easy bc of bands)",
    difficulty: "e",
    variantGroup: VariantGroup.MERCH,
  },
  {
    summary: "Photographer",
    description: "Someone asks us to take their picture",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Mike Wasowski'd",
    description: "Your face gets blocked in a ride photo (>50%)",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Apes together strong",
    description: "Planned group photo pose goes successfully",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Stay hydrated",
    description: "You have more than 5 refills in one day",
    difficulty: "e", // PLACEHOLDER - CHANGE
    eligiblePeople: ["Maria", "Ben", "Jason", "Ciara"],
  },
  {
    summary: "We're Athletes",
    description: "Someone asks us about our quadball T shirts",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "We're Famous",
    description: "Someone recognises our group Disney bounding",
    difficulty: "h",
  },
  {
    summary: "This is my jam",
    description: (inputs) => `We get ${inputs.song} on Guardians of the Galaxy`,
    difficulty: "h",
    guaranteed: true,
  },
  {
    summary: (inputs) => `${inputs.drinker}'s tipsy`,
    description: (inputs) =>
      `${inputs.drinker} does something that's clearly due to being tipsy/drunk`,
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Doppelganger",
    description: "We see a character that we are Disney bounding as",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "End of the world",
    description: "Deviate from the plan (we go to a park not planned)",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder show cancelled", // TODO
    description: "Show that we were going to see gets cancelled for weather",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Rizzler",
    description: "Wave at a character and get a wave back",
    difficulty: "e",
  },
  {
    summary: "Master focus",
    description: "We go a whole day without talking about quadball",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    // Draft notes not yet incorporated: "can't be a list of numbers", and an
    // undecided bonus-points-for-wearing-the-jersey idea -- see draft-ideas.md.
    summary: "placeholder shirt number find", // TODO
    description: (inputs) =>
      `Find something with your shirt number (${inputs.shirtNumber}) on it & take a picture`,
    difficulty: "e", // PLACEHOLDER - CHANGE
    guaranteed: true,
  },
  {
    summary: "placeholder security confiscated", // TODO
    description: "Someone has something confiscated at security",
    difficulty: "e", // PLACEHOLDER - CHANGE
    variantGroup: VariantGroup.SECURITY_INCIDENT,
  },
  {
    summary: "placeholder security pat down", // TODO
    description: "Someone gets a pat down at security",
    difficulty: "e", // PLACEHOLDER - CHANGE
    variantGroup: VariantGroup.SECURITY_INCIDENT,
  },
  {
    summary: "placeholder security slowdown", // TODO
    description: "Someone's stuff slows us down going through park security",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Meatball-less",
    description: "Day with no rain",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder queue jumped", // TODO
    description: "Someone gets queue jumped",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder blister", // TODO
    description: "Someone gets a blister",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder crying photo", // TODO
    description: "Someone's crying in a ride photo",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder faceplant", // TODO
    description: "We see someone faceplant",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder banana fall", // TODO
    description: "We see someone banana peel fall",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder family argument", // TODO
    description: "We see a Disney family argument",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder trip meme", // TODO
    description:
      "Make a meme about the trip/with a photo from the trip which someone laughs out loud to when they first see it",
    difficulty: "e", // PLACEHOLDER - CHANGE
    guaranteed: true,
  },
  {
    summary: "placeholder miss rope drop", // TODO
    description: "We miss rope drop",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Bad Smuggler",
    description: "Someone's a terrible pilot on smugglers run",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "placeholder open to close", // TODO
    description: "We're in the park from open till close (3 days)",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Y'all British?",
    description: "Someone mentions that's we're British or says that they love our accent?",
    difficulty: "m",
  },
  {
    summary: "placeholder forgot swimsuit", // TODO
    description: "Someone forgets their swimsuit",
    difficulty: "h",
  },
  {
    summary: "placeholder forgot jersey", // TODO
    description: "Someone forgets their Jersey",
    difficulty: "h",
  },
  {
    summary: "placeholder hidden mickey", // TODO
    description: "You find a verified Hidden Mickey",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
  {
    summary: "Worth it",
    description: "Someone's quick service meal snack points is valued over $30",
    difficulty: "m",
  },
  {
    summary: "Walk-on",
    description: "Less than 3 mins from entering the queue to getting onto the ride",
    difficulty: "e", // PLACEHOLDER - CHANGE
  },
];
