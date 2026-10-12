-- مركز التحسين والتطوير: أهداف / دراسة تكلفة / خطة تنفيذ / تقييم نتائج
-- نفّذ مرة واحدة فقط بعد نسخة احتياطية وقبل نشر ملفات التطبيق.
-- جميع الحقول الجديدة اختيارية للأفكار القديمة. costStudyRequired=0 يحفظ استمرار إجراءاتها.
-- تُنشأ الأفكار الجديدة مع costStudyRequired=1 من الخادم، ويلزم لها التقييم قبل الإغلاق.
ALTER TABLE `improvement_ideas`
  ADD COLUMN `currentSituation` TEXT NULL,
  ADD COLUMN `targetOutcome` TEXT NULL,
  ADD COLUMN `successMetric` TEXT NULL,
  ADD COLUMN `baselineValue` DECIMAL(14,2) NULL,
  ADD COLUMN `targetValue` DECIMAL(14,2) NULL,
  ADD COLUMN `costStudyRequired` TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `estimatedMaterialsCost` DECIMAL(14,2) NULL,
  ADD COLUMN `estimatedLaborCost` DECIMAL(14,2) NULL,
  ADD COLUMN `estimatedServicesCost` DECIMAL(14,2) NULL,
  ADD COLUMN `costStudyNotes` TEXT NULL,
  ADD COLUMN `costStudyById` INT NULL,
  ADD COLUMN `costStudiedAt` TIMESTAMP NULL,
  ADD COLUMN `implementationOwner` VARCHAR(200) NULL,
  ADD COLUMN `implementationStartDate` DATE NULL,
  ADD COLUMN `implementationDueDate` DATE NULL,
  ADD COLUMN `implementationProgress` INT NOT NULL DEFAULT 0,
  ADD COLUMN `implementationNotes` TEXT NULL,
  ADD COLUMN `actualCost` DECIMAL(14,2) NULL,
  ADD COLUMN `achievedValue` DECIMAL(14,2) NULL,
  ADD COLUMN `resultRating` ENUM('achieved','partial','not_achieved') NULL,
  ADD COLUMN `resultNotes` TEXT NULL,
  ADD COLUMN `evaluatedAt` TIMESTAMP NULL,
  ADD COLUMN `evaluatedById` INT NULL;
