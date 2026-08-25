CREATE TABLE IF NOT EXISTS ai_response_cache (
  id INT NOT NULL AUTO_INCREMENT,
  cacheKey VARCHAR(64) NOT NULL,
  feature VARCHAR(100) NOT NULL,
  operation VARCHAR(100) NOT NULL,
  cacheVersion VARCHAR(50) NOT NULL,
  responsePayload JSON NOT NULL,
  hitCount INT UNSIGNED NOT NULL DEFAULT 0,
  expiresAt TIMESTAMP NOT NULL,
  lastHitAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_response_cache_key (cacheKey),
  KEY idx_ai_response_cache_feature (feature),
  KEY idx_ai_response_cache_expires (expiresAt)
) ENGINE=InnoDB;
