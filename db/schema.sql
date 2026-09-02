CREATE TABLE teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  region VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE alliances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seed TINYINT NOT NULL UNIQUE,
  captain_team_id INT NOT NULL,
  pick1_team_id INT NULL,
  pick2_team_id INT NULL,
  FOREIGN KEY (captain_team_id) REFERENCES teams(id),
  FOREIGN KEY (pick1_team_id) REFERENCES teams(id),
  FOREIGN KEY (pick2_team_id) REFERENCES teams(id)
) ENGINE=InnoDB;

CREATE TABLE matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_number INT NOT NULL,
  phase ENUM('qualification','playoff') NOT NULL DEFAULT 'qualification',
  red_alliance_id INT NULL,
  blue_alliance_id INT NULL,
  red1_id INT NOT NULL, red2_id INT NOT NULL, red3_id INT NOT NULL,
  blue1_id INT NOT NULL, blue2_id INT NOT NULL, blue3_id INT NOT NULL,
  played BOOLEAN NOT NULL DEFAULT FALSE,
  suppression_red INT NOT NULL DEFAULT 0,
  suppression_blue INT NOT NULL DEFAULT 0,
  extinguisher INT NOT NULL DEFAULT 0,
  climb_red1 ENUM('none','contact','zone1','zone2','zone3') NOT NULL DEFAULT 'none',
  climb_red2 ENUM('none','contact','zone1','zone2','zone3') NOT NULL DEFAULT 'none',
  climb_red3 ENUM('none','contact','zone1','zone2','zone3') NOT NULL DEFAULT 'none',
  climb_blue1 ENUM('none','contact','zone1','zone2','zone3') NOT NULL DEFAULT 'none',
  climb_blue2 ENUM('none','contact','zone1','zone2','zone3') NOT NULL DEFAULT 'none',
  climb_blue3 ENUM('none','contact','zone1','zone2','zone3') NOT NULL DEFAULT 'none',
  partner_climb_red TINYINT NOT NULL DEFAULT 0,
  partner_climb_blue TINYINT NOT NULL DEFAULT 0,
  minor_fouls_red TINYINT NOT NULL DEFAULT 0,
  major_fouls_red TINYINT NOT NULL DEFAULT 0,
  minor_fouls_blue TINYINT NOT NULL DEFAULT 0,
  major_fouls_blue TINYINT NOT NULL DEFAULT 0,
  card_red1 ENUM('none','yellow','white','red') NOT NULL DEFAULT 'none',
  card_red2 ENUM('none','yellow','white','red') NOT NULL DEFAULT 'none',
  card_red3 ENUM('none','yellow','white','red') NOT NULL DEFAULT 'none',
  card_blue1 ENUM('none','yellow','white','red') NOT NULL DEFAULT 'none',
  card_blue2 ENUM('none','yellow','white','red') NOT NULL DEFAULT 'none',
  card_blue3 ENUM('none','yellow','white','red') NOT NULL DEFAULT 'none',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_phase_number (phase, match_number)
) ENGINE=InnoDB;
