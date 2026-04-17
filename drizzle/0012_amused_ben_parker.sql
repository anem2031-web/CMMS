CREATE TABLE `two_factor_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(50) NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`success` boolean NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `two_factor_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `two_factor_secrets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`secret` varchar(255) NOT NULL,
	`backupCodes` text NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`enabledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `two_factor_secrets_id` PRIMARY KEY(`id`),
	CONSTRAINT `two_factor_secrets_userId_unique` UNIQUE(`userId`)
);
