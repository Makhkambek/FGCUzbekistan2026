export type ClimbPosition = 'none' | 'contact' | 'zone1' | 'zone2' | 'zone3';
export type CardType = 'none' | 'yellow' | 'white' | 'red';

export interface AllianceInput {
  suppression: number;
  climbs: [ClimbPosition, ClimbPosition, ClimbPosition];
  partnerClimbs: number;
  minorFouls: number;
  majorFouls: number;
}

export interface MatchInput {
  red: AllianceInput;
  blue: AllianceInput;
  extinguisher: number;
}

export interface MatchScores {
  red: number;
  blue: number;
  redPre: number;
  bluePre: number;
  coopertition: number;
  redMultiplier: number;
  blueMultiplier: number;
}
