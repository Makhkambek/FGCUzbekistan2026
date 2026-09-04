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

-- Single-row table tracking what the public display screen should show.
-- id is pinned to 1 so there is always exactly one state to read/update.
CREATE TABLE display_state (
  id TINYINT PRIMARY KEY DEFAULT 1,
  phase ENUM('standings','live','result') NOT NULL DEFAULT 'standings',
  match_id INT NULL,
  -- When the referee started the match on the field. The projector counts the
  -- 2:30 down from this, so it must come from the server: three screens
  -- reading their own laptop clocks would disagree with each other.
  started_at DATETIME(3) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id),
  CONSTRAINT chk_display_state_single_row CHECK (id = 1)
) ENGINE=InnoDB;

INSERT INTO display_state (id, phase, match_id) VALUES (1, 'standings', NULL);
