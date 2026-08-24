CREATE TABLE catalog_item_candidate_duplicate_decisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidateLowId INT NOT NULL,
  candidateHighId INT NOT NULL,
  decision ENUM('same_item','not_same_item') NOT NULL,
  primaryCandidateId INT NULL,
  decidedById INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_item_candidate_duplicate_pair (candidateLowId, candidateHighId),
  KEY idx_catalog_item_candidate_duplicate_low (candidateLowId),
  KEY idx_catalog_item_candidate_duplicate_high (candidateHighId),
  KEY idx_catalog_item_candidate_duplicate_primary (primaryCandidateId)
);
