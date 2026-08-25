-- LOT-only sequential numbering counter.
-- Live DB was created manually under change control before this migration file
-- was added to the project. IF NOT EXISTS keeps fresh/install environments aligned
-- without modifying or renumbering any historical LOT rows.
CREATE TABLE IF NOT EXISTS inventory_lot_number_counter (
    year SMALLINT UNSIGNED NOT NULL,
    lastNumber INT UNSIGNED NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (year)
) ENGINE=InnoDB;
