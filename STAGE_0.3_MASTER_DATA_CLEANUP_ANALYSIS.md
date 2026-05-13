# Stage 0.3 — Pre-Delivery Master Data Cleanup Analysis

## 1. Objective
This report provides a comprehensive analysis of the Master Data layer in the CMMS system to prepare a clean, professional, and client-ready baseline. The analysis focuses on identifying experimental records, invalid mappings, duplicates, and broken relationships across users, technicians, sites, and assets. It is important to note that **no data has been deleted or modified during this stage**.

---

## 2. Master Data Findings

The analysis of the master data revealed a mix of legitimate operational records and seeded experimental data across various core entities. The system's foundational structure remains intact, but specific areas require targeted cleanup to ensure client readiness.

### 2.1. Users and Technicians
The system currently holds 296 user records. Among these, 256 are identified as real, operational users characterized by Arabic names or known system usernames such as `admin`, `KHALED`, and `FATAH`. Conversely, 40 users are clearly seeded or experimental, identifiable by their English names, numeric usernames, and high database IDs (greater than 1,000,000). A notable anomaly is that 41 users have empty or null roles, which includes the 40 seeded users and one additional account. Furthermore, one specific user (ID: 1, Name: `anem2031`, Role: `owner`) has a null username. Fortunately, there are no duplicate usernames or names, and all assigned roles correspond to valid system schemas.

In contrast, the `technicians` table is completely clean. It contains 12 records, all of which represent real, operational technicians with Arabic names (e.g., `جابر`, `امتياز`, `هزور`). The table operates independently without a direct foreign key (`userId`) linking it to the `users` table. There are no duplicate technician names or invalid mappings detected based on the current schema structure.

### 2.2. Sites, Sections, and Assets
The geographical hierarchy consists of 4 sites and 17 sections. All of these represent real, operational locations (e.g., `ملاهي الحكير تايم`, `حديقة الوطن`, `كوفي تن بليون`). There are no duplicate entries or broken relationships; specifically, zero sections possess invalid `siteId` references.

The asset inventory, however, is heavily polluted with experimental data. While there is only 1 valid asset category (`مكائن القلايه`), the `assets` table contains a total of 2,073 records. Only 96 of these are real assets with Arabic names. The remaining 1,977 assets are seeded entries generated using Faker.js, exhibiting English naming patterns such as `Incredible Concrete Car` and `Frozen Bamboo Ball`. This seeded data introduces significant relational integrity issues.

| Broken Relationship Type | Affected Asset Count | Description |
| :--- | :---: | :--- |
| **Invalid Site ID** | 967 | Assets point to a non-existent site ID (`330001`). |
| **Invalid Section ID** | 98 | Assets point to a non-existent section ID (`30001`). |
| **Duplicate Names** | Multiple | Several seeded assets share identical names (e.g., `Incredible Granite Ball` appears 3 times). |

Additionally, an inspection of related tables showed that there are 0 records in `preventive_plans`, and the `permissions` table does not exist in the current database schema.

---

## 3. Risk Assessment

The presence of seeded and malformed data poses varying degrees of risk to the system's stability and professional presentation.

| Risk Area | Risk Level | Description |
| :--- | :---: | :--- |
| **Fake/Seeded Assets** | High | The 1,977 seeded assets with English names heavily distort the system's professional appearance, skew reporting metrics, and clutter the user interface. |
| **Broken Asset Links** | High | The 967 assets pointing to a non-existent `siteId` and 98 pointing to a non-existent `sectionId` will lead to broken UI filtering, mapping errors, and potential application crashes when navigating location hierarchies. |
| **Fake/Seeded Users** | Medium | The 40 users with empty roles and English names clutter the system. As previously discovered, empty roles directly caused frontend crashes in the User Management module. |
| **Empty Username** | Low | The single user (`anem2031`) with a null username could encounter login failures or display anomalies if not corrected. |

---

## 4. Recommended Cleanup Strategy

To achieve a pristine, **Client-Ready Baseline**, a targeted and safe cleanup execution is recommended. The strategy focuses on eliminating experimental data while preserving all legitimate operational master data.

First, a purge of seeded assets is required. Deleting all 1,977 assets where the name matches the Faker.js English pattern (or simply targeting IDs greater than 100,000) will instantly resolve the broken relationship risks. Because the invalid `siteId` and `sectionId` references belong entirely to this seeded dataset, their removal restores relational integrity.

Second, the seeded users must be purged. Deleting the 40 experimental users (IDs greater than 1,000,000, possessing English names and empty roles) will clean the user directory and prevent related UI bugs.

Third, minor anomalies should be corrected. Specifically, user ID `1` (`anem2031`) should be updated to possess a valid username string to ensure consistent authentication and display behavior.

Finally, the core data must be strictly preserved. The execution must ensure that all 256 real users, 12 technicians, 4 sites, 17 sections, and 96 real assets remain completely intact.

---

## 5. Client-Readiness Assessment & Recommendation

**Current State:** NOT READY. The system is currently burdened with a massive volume of seeded Faker.js data across assets and users. This experimental data breaks critical database relationships and presents a highly unprofessional appearance unsuitable for client onboarding.

**Recommendation:** **GO**. It is highly recommended to proceed with the targeted cleanup strategy outlined above. Executing this cleanup will remove the seeded assets and users, resolving all identified relational errors. Once completed, the Master Data will be 100% clean, consistent, and fully prepared for client delivery.
