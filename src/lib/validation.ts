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
  partnerClimbRed: z.number().int().min(0).max(2),
  partnerClimbBlue: z.number().int().min(0).max(2),
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

export type MatchResultInput = z.infer<typeof matchResultSchema>;
