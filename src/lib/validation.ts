import { z } from 'zod';

const climb = z.enum(['none', 'contact', 'zone1', 'zone2', 'zone3']);
const card = z.enum(['none', 'yellow', 'white', 'red']);
const wildfire = z.number().int().min(0).max(500);
const fouls = z.number().int().min(0).max(20);

export const matchResultSchema = z.object({
  suppressionRed: wildfire,
  suppressionBlue: wildfire,
  extinguisher: wildfire,
  climbRed: z.tuple([climb, climb, climb]),
  climbBlue: z.tuple([climb, climb, climb]),
  // An alliance is two robots in both phases, and two robots can lift one
  // partner between them — never two.
  partnerClimbRed: z.number().int().min(0).max(1),
  partnerClimbBlue: z.number().int().min(0).max(1),
  minorFoulsRed: fouls, majorFoulsRed: fouls,
  minorFoulsBlue: fouls, majorFoulsBlue: fouls,
  cardRed: z.tuple([card, card, card]),
  cardBlue: z.tuple([card, card, card]),
});

export const teamSchema = z.object({
  name: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).optional(),
});

export const scheduleParamsSchema = z.object({
  matchesPerTeam: z.number().int().min(1).max(20),
  seed: z.number().int().min(0),
});

export const skillsScheduleSchema = z.object({
  teamIds: z.array(z.number().int().positive()).min(1).max(64),
  attemptsPerTeam: z.number().int().min(1).max(10),
  alliance: z.enum(['red', 'blue']),
});

export const skillsResultSchema = z.object({
  suppression: wildfire,
  humanBalls: z.number().int().min(0).max(500),
  climb,
  extinguisher: wildfire,
  minorFouls: fouls,
  majorFouls: fouls,
  card,
});

export const skillsAllianceSchema = z.object({
  alliance: z.enum(['red', 'blue']),
});

/**
 * A referee account, as the site itself accepts one.
 *
 * The twelve-character floor is the same one scripts/create-admin.ts applies;
 * it lives here as well because a freshly deployed server has no way to run
 * that script — the runtime image carries the built server and nothing else.
 * No spaces in a name: it is typed on a phone at the scoring table, twice.
 */
export const accountSchema = z.object({
  username: z.string().trim().min(1).max(64).regex(/^\S+$/),
  password: z.string().min(12).max(200),
});

export const displayStartSchema = z.object({
  matchId: z.number().int().positive(),
});

export type MatchResultInput = z.infer<typeof matchResultSchema>;
export type SkillsResultBody = z.infer<typeof skillsResultSchema>;
