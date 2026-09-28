-- Seed script to ensure at least 5 records in each table
DO $$
DECLARE
    -- User IDs
    u_admin_id UUID;
    u_ops_id UUID := '11111111-1111-1111-1111-111111111111';
    u_fleet_id UUID;
    u_guide_id UUID;
    u_traveler1_id UUID := '22222222-2222-2222-2222-222222222221';
    u_traveler2_id UUID := '22222222-2222-2222-2222-222222222222';
    u_traveler3_id UUID := '22222222-2222-2222-2222-222222222223';
    u_traveler4_id UUID := '22222222-2222-2222-2222-222222222224';
    u_traveler5_id UUID := '22222222-2222-2222-2222-222222222225';

    -- Package IDs
    pkg_cultural_id UUID;
    pkg_hill_id UUID;
    pkg_coastal_id UUID;
    pkg_wildlife_id UUID := '33333333-3333-3333-3333-333333333331';
    pkg_northern_id UUID := '33333333-3333-3333-3333-333333333332';

    -- Package Tier IDs
    tier_cultural_1 UUID;
    tier_cultural_norm UUID;
    tier_hill_1 UUID;
    tier_hill_2 UUID;
    tier_hill_norm UUID;
    tier_coastal_1 UUID;
    tier_wildlife_1 UUID := '44444444-4444-4444-4444-444444444441';
    tier_wildlife_norm UUID := '44444444-4444-4444-4444-444444444442';
    tier_northern_1 UUID := '44444444-4444-4444-4444-444444444443';

    -- Vehicles
    veh_1 UUID := '55555555-5555-5555-5555-555555555551';
    veh_2 UUID := '55555555-5555-5555-5555-555555555552';
    veh_3 UUID := '55555555-5555-5555-5555-555555555553';
    veh_4 UUID := '55555555-5555-5555-5555-555555555554';
    veh_5 UUID := '55555555-5555-5555-5555-555555555555';

    -- Drivers
    drv_1 UUID := '66666666-6666-6666-6666-666666666661';
    drv_2 UUID := '66666666-6666-6666-6666-666666666662';
    drv_3 UUID := '66666666-6666-6666-6666-666666666663';
    drv_4 UUID := '66666666-6666-6666-6666-666666666664';
    drv_5 UUID := '66666666-6666-6666-6666-666666666665';

    -- Guides
    gde_1 UUID := '77777777-7777-7777-7777-777777777771';
    gde_2 UUID := '77777777-7777-7777-7777-777777777772';
    gde_3 UUID := '77777777-7777-7777-7777-777777777773';
    gde_4 UUID := '77777777-7777-7777-7777-777777777774';
    gde_5 UUID := '77777777-7777-7777-7777-777777777775';

    -- Bookings
    bkg_1 UUID := '88888888-8888-8888-8888-888888888881';
    bkg_2 UUID := '88888888-8888-8888-8888-888888888882';
    bkg_3 UUID := '88888888-8888-8888-8888-888888888883';
    bkg_4 UUID := '88888888-8888-8888-8888-888888888884';
    bkg_5 UUID := '88888888-8888-8888-8888-888888888885';
    bkg_6 UUID := '88888888-8888-8888-8888-888888888886';

    -- Agent Workflow Runs
    wf_1 UUID := '99999999-9999-9999-9999-999999999991';
    wf_2 UUID := '99999999-9999-9999-9999-999999999992';
    wf_3 UUID := '99999999-9999-9999-9999-999999999993';
    wf_4 UUID := '99999999-9999-9999-9999-999999999994';
    wf_5 UUID := '99999999-9999-9999-9999-999999999995';

    -- Default password hash (ChangeMe123!)
    default_hash TEXT := 'AQAAAAIAAYagAAAAEPz7t5nTgnCiEvDuSPwM/I7SqsZKPhtXTOLS9NkQ63wk32O7/pdXRajXZAa10Ivwwg==';
BEGIN
    ----------------------------------------------------------------------------
    -- 1. USERS (Ensure at least 5)
    ----------------------------------------------------------------------------
    -- Retrieve existing Admin if present
    SELECT "Id" INTO u_admin_id FROM "Users" WHERE "Email" = 'admin@trailwise.local' LIMIT 1;
    IF u_admin_id IS NULL THEN
        u_admin_id := '11111111-1111-1111-1111-111111111110';
        INSERT INTO "Users" ("Id", "Name", "Email", "ContactNumber", "PasswordHash", "Role", "CreatedAt", "UpdatedAt")
        VALUES (u_admin_id, 'System Admin', 'admin@trailwise.local', '+94770000001', default_hash, 'Admin', NOW(), NOW());
    END IF;

    -- Ensure Operations Manager
    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = 'ops@trailwise.local') THEN
        INSERT INTO "Users" ("Id", "Name", "Email", "ContactNumber", "PasswordHash", "Role", "CreatedAt", "UpdatedAt")
        VALUES (u_ops_id, 'Sarah Ops', 'ops@trailwise.local', '+94770000002', default_hash, 'OperationsManager', NOW(), NOW());
    END IF;

    -- Ensure Fleet Coordinator
    SELECT "Id" INTO u_fleet_id FROM "Users" WHERE "Email" = 'fleet@trailwise.local' LIMIT 1;
    IF u_fleet_id IS NULL THEN
        u_fleet_id := '11111111-1111-1111-1111-111111111112';
        INSERT INTO "Users" ("Id", "Name", "Email", "ContactNumber", "PasswordHash", "Role", "CreatedAt", "UpdatedAt")
        VALUES (u_fleet_id, 'Kamal Silva', 'fleet@trailwise.local', '+94770000003', default_hash, 'FleetCoordinator', NOW(), NOW());
    END IF;

    -- Travelers
    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = 'alice@example.com') THEN
        INSERT INTO "Users" ("Id", "Name", "Email", "ContactNumber", "PasswordHash", "Role", "CreatedAt", "UpdatedAt")
        VALUES (u_traveler1_id, 'Alice Henderson', 'alice@example.com', '+447911123456', default_hash, 'Traveler', NOW(), NOW());
    ELSE
        SELECT "Id" INTO u_traveler1_id FROM "Users" WHERE "Email" = 'alice@example.com' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = 'bob@example.com') THEN
        INSERT INTO "Users" ("Id", "Name", "Email", "ContactNumber", "PasswordHash", "Role", "CreatedAt", "UpdatedAt")
        VALUES (u_traveler2_id, 'Bob Martin', 'bob@example.com', '+61412345678', default_hash, 'Traveler', NOW(), NOW());
    ELSE
        SELECT "Id" INTO u_traveler2_id FROM "Users" WHERE "Email" = 'bob@example.com' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = 'clara@example.com') THEN
        INSERT INTO "Users" ("Id", "Name", "Email", "ContactNumber", "PasswordHash", "Role", "CreatedAt", "UpdatedAt")
        VALUES (u_traveler3_id, 'Clara Oswald', 'clara@example.com', '+14155552671', default_hash, 'Traveler', NOW(), NOW());
    ELSE
        SELECT "Id" INTO u_traveler3_id FROM "Users" WHERE "Email" = 'clara@example.com' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = 'david@example.com') THEN
        INSERT INTO "Users" ("Id", "Name", "Email", "ContactNumber", "PasswordHash", "Role", "CreatedAt", "UpdatedAt")
        VALUES (u_traveler4_id, 'David Miller', 'david@example.com', '+49151234567', default_hash, 'Traveler', NOW(), NOW());
    ELSE
        SELECT "Id" INTO u_traveler4_id FROM "Users" WHERE "Email" = 'david@example.com' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE "Email" = 'emma@example.com') THEN
        INSERT INTO "Users" ("Id", "Name", "Email", "ContactNumber", "PasswordHash", "Role", "CreatedAt", "UpdatedAt")
        VALUES (u_traveler5_id, 'Emma Watson', 'emma@example.com', '+33612345678', default_hash, 'Traveler', NOW(), NOW());
    ELSE
        SELECT "Id" INTO u_traveler5_id FROM "Users" WHERE "Email" = 'emma@example.com' LIMIT 1;
    END IF;

    ----------------------------------------------------------------------------
    -- 2. TOUR PACKAGES & PACKAGE TIERS & PACKAGE LOCATIONS
    ----------------------------------------------------------------------------
    SELECT "Id" INTO pkg_cultural_id FROM "TourPackages" WHERE "Name" = 'Cultural Triangle Explorer' LIMIT 1;
    SELECT "Id" INTO pkg_hill_id FROM "TourPackages" WHERE "Name" = 'Hill Country Adventure' LIMIT 1;
    SELECT "Id" INTO pkg_coastal_id FROM "TourPackages" WHERE "Name" = 'Coastal Getaway' LIMIT 1;

    -- Add 4th and 5th packages if needed
    IF NOT EXISTS (SELECT 1 FROM "TourPackages" WHERE "Name" = 'Yala & Udawalawe Wildlife Safari') THEN
        INSERT INTO "TourPackages" ("Id", "Name", "Theme", "DurationDays", "BasePricePerPerson", "MaxGroupSize", "PhotoUrl", "CreatedAt", "UpdatedAt")
        VALUES (pkg_wildlife_id, 'Yala & Udawalawe Wildlife Safari', 'Wildlife', 3, 350.00, 8, null, NOW(), NOW());

        INSERT INTO "PackageTiers" ("Id", "TourPackageId", "ClassType", "IncludesFood", "BasePricePerPerson", "RequiresAC", "CreatedAt", "UpdatedAt")
        VALUES
        (tier_wildlife_norm, pkg_wildlife_id, 'Normal', false, 350.00, false, NOW(), NOW()),
        (tier_wildlife_1, pkg_wildlife_id, 'First', true, 490.00, true, NOW(), NOW());

        INSERT INTO "PackageLocations" ("Id", "TourPackageId", "Name", "CreatedAt", "UpdatedAt")
        VALUES
        (gen_random_uuid(), pkg_wildlife_id, 'Yala National Park', NOW(), NOW()),
        (gen_random_uuid(), pkg_wildlife_id, 'Udawalawe', NOW(), NOW());
    ELSE
        SELECT "Id" INTO pkg_wildlife_id FROM "TourPackages" WHERE "Name" = 'Yala & Udawalawe Wildlife Safari' LIMIT 1;
        SELECT "Id" INTO tier_wildlife_1 FROM "PackageTiers" WHERE "TourPackageId" = pkg_wildlife_id AND "ClassType" = 'First' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "TourPackages" WHERE "Name" = 'Jaffna & Northern Heritage Expedition') THEN
        INSERT INTO "TourPackages" ("Id", "Name", "Theme", "DurationDays", "BasePricePerPerson", "MaxGroupSize", "PhotoUrl", "CreatedAt", "UpdatedAt")
        VALUES (pkg_northern_id, 'Jaffna & Northern Heritage Expedition', 'Cultural', 6, 420.00, 14, null, NOW(), NOW());

        INSERT INTO "PackageTiers" ("Id", "TourPackageId", "ClassType", "IncludesFood", "BasePricePerPerson", "RequiresAC", "CreatedAt", "UpdatedAt")
        VALUES
        (tier_northern_1, pkg_northern_id, 'First', true, 580.00, true, NOW(), NOW());

        INSERT INTO "PackageLocations" ("Id", "TourPackageId", "Name", "CreatedAt", "UpdatedAt")
        VALUES
        (gen_random_uuid(), pkg_northern_id, 'Jaffna Fort', NOW(), NOW()),
        (gen_random_uuid(), pkg_northern_id, 'Nallur Kandaswamy Kovil', NOW(), NOW()),
        (gen_random_uuid(), pkg_northern_id, 'Nagadeepa', NOW(), NOW());
    ELSE
        SELECT "Id" INTO pkg_northern_id FROM "TourPackages" WHERE "Name" = 'Jaffna & Northern Heritage Expedition' LIMIT 1;
        SELECT "Id" INTO tier_northern_1 FROM "PackageTiers" WHERE "TourPackageId" = pkg_northern_id LIMIT 1;
    END IF;

    -- Pick existing tiers for booking references
    SELECT "Id" INTO tier_cultural_1 FROM "PackageTiers" WHERE "TourPackageId" = pkg_cultural_id AND "ClassType" = 'First' LIMIT 1;
    SELECT "Id" INTO tier_cultural_norm FROM "PackageTiers" WHERE "TourPackageId" = pkg_cultural_id AND "ClassType" = 'Normal' LIMIT 1;
    SELECT "Id" INTO tier_hill_1 FROM "PackageTiers" WHERE "TourPackageId" = pkg_hill_id AND "ClassType" = 'First' LIMIT 1;
    SELECT "Id" INTO tier_hill_2 FROM "PackageTiers" WHERE "TourPackageId" = pkg_hill_id AND "ClassType" = 'Second' LIMIT 1;
    SELECT "Id" INTO tier_coastal_1 FROM "PackageTiers" WHERE "TourPackageId" = pkg_coastal_id AND "ClassType" = 'First' LIMIT 1;

    ----------------------------------------------------------------------------
    -- 3. VEHICLES (Ensure at least 5)
    ----------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM "Vehicles" WHERE "SeatConfiguration" = '2-2-3 (Executive Van)') THEN
        INSERT INTO "Vehicles" ("Id", "Type", "Capacity", "HasAC", "SeatConfiguration", "MaintenanceStatus", "CreatedAt", "UpdatedAt")
        VALUES (veh_1, 'Van', 7, true, '2-2-3 (Executive Van)', 'Available', NOW(), NOW());
    ELSE
        SELECT "Id" INTO veh_1 FROM "Vehicles" WHERE "SeatConfiguration" = '2-2-3 (Executive Van)' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Vehicles" WHERE "SeatConfiguration" = '2-3-3-4 (Commuter Van)') THEN
        INSERT INTO "Vehicles" ("Id", "Type", "Capacity", "HasAC", "SeatConfiguration", "MaintenanceStatus", "CreatedAt", "UpdatedAt")
        VALUES (veh_2, 'Van', 12, true, '2-3-3-4 (Commuter Van)', 'Available', NOW(), NOW());
    ELSE
        SELECT "Id" INTO veh_2 FROM "Vehicles" WHERE "SeatConfiguration" = '2-3-3-4 (Commuter Van)' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Vehicles" WHERE "SeatConfiguration" = '2-2 Luxury (4x4 SUV)') THEN
        INSERT INTO "Vehicles" ("Id", "Type", "Capacity", "HasAC", "SeatConfiguration", "MaintenanceStatus", "CreatedAt", "UpdatedAt")
        VALUES (veh_3, 'SUV', 4, true, '2-2 Luxury (4x4 SUV)', 'Available', NOW(), NOW());
    ELSE
        SELECT "Id" INTO veh_3 FROM "Vehicles" WHERE "SeatConfiguration" = '2-2 Luxury (4x4 SUV)' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Vehicles" WHERE "SeatConfiguration" = '2-2 across 8 rows (Mini Coach)') THEN
        INSERT INTO "Vehicles" ("Id", "Type", "Capacity", "HasAC", "SeatConfiguration", "MaintenanceStatus", "CreatedAt", "UpdatedAt")
        VALUES (veh_4, 'Coach', 32, true, '2-2 across 8 rows (Mini Coach)', 'Available', NOW(), NOW());
    ELSE
        SELECT "Id" INTO veh_4 FROM "Vehicles" WHERE "SeatConfiguration" = '2-2 across 8 rows (Mini Coach)' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Vehicles" WHERE "SeatConfiguration" = '2-3 across 9 rows (Tour Coach)') THEN
        INSERT INTO "Vehicles" ("Id", "Type", "Capacity", "HasAC", "SeatConfiguration", "MaintenanceStatus", "CreatedAt", "UpdatedAt")
        VALUES (veh_5, 'Coach', 45, true, '2-3 across 9 rows (Tour Coach)', 'UnderMaintenance', NOW(), NOW());
    ELSE
        SELECT "Id" INTO veh_5 FROM "Vehicles" WHERE "SeatConfiguration" = '2-3 across 9 rows (Tour Coach)' LIMIT 1;
    END IF;

    ----------------------------------------------------------------------------
    -- 4. DRIVERS (Ensure at least 5)
    ----------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM "Drivers" WHERE "LicenseNumber" = 'B-1029384') THEN
        INSERT INTO "Drivers" ("Id", "Name", "LicenseNumber", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (drv_1, 'Sunil Jayawardena', 'B-1029384', '+94711122334', NOW(), NOW());
    ELSE
        SELECT "Id" INTO drv_1 FROM "Drivers" WHERE "LicenseNumber" = 'B-1029384' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Drivers" WHERE "LicenseNumber" = 'B-5544332') THEN
        INSERT INTO "Drivers" ("Id", "Name", "LicenseNumber", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (drv_2, 'Pradeep Kumara', 'B-5544332', '+94772233445', NOW(), NOW());
    ELSE
        SELECT "Id" INTO drv_2 FROM "Drivers" WHERE "LicenseNumber" = 'B-5544332' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Drivers" WHERE "LicenseNumber" = 'B-7788990') THEN
        INSERT INTO "Drivers" ("Id", "Name", "LicenseNumber", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (drv_3, 'Ruwan Mendis', 'B-7788990', '+94753344556', NOW(), NOW());
    ELSE
        SELECT "Id" INTO drv_3 FROM "Drivers" WHERE "LicenseNumber" = 'B-7788990' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Drivers" WHERE "LicenseNumber" = 'C-9900112') THEN
        INSERT INTO "Drivers" ("Id", "Name", "LicenseNumber", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (drv_4, 'Chaminda Bandara', 'C-9900112', '+94724455667', NOW(), NOW());
    ELSE
        SELECT "Id" INTO drv_4 FROM "Drivers" WHERE "LicenseNumber" = 'C-9900112' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Drivers" WHERE "LicenseNumber" = 'C-3344556') THEN
        INSERT INTO "Drivers" ("Id", "Name", "LicenseNumber", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (drv_5, 'Anura Fernando', 'C-3344556', '+94785566778', NOW(), NOW());
    ELSE
        SELECT "Id" INTO drv_5 FROM "Drivers" WHERE "LicenseNumber" = 'C-3344556' LIMIT 1;
    END IF;

    ----------------------------------------------------------------------------
    -- 5. GUIDES (Ensure at least 5)
    ----------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM "Guides" WHERE "Name" = 'Janith Wijesinghe') THEN
        INSERT INTO "Guides" ("Id", "Name", "Languages", "Specializations", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (gde_1, 'Janith Wijesinghe', ARRAY['English', 'Sinhala', 'German'], ARRAY['Historical Sites', 'Cultural Heritage'], '+94771239876', NOW(), NOW());
    ELSE
        SELECT "Id" INTO gde_1 FROM "Guides" WHERE "Name" = 'Janith Wijesinghe' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Guides" WHERE "Name" = 'Ravi Shanmugam') THEN
        INSERT INTO "Guides" ("Id", "Name", "Languages", "Specializations", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (gde_2, 'Ravi Shanmugam', ARRAY['English', 'Tamil', 'French'], ARRAY['Northern Heritage', 'Birdwatching'], '+94779876543', NOW(), NOW());
    ELSE
        SELECT "Id" INTO gde_2 FROM "Guides" WHERE "Name" = 'Ravi Shanmugam' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Guides" WHERE "Name" = 'Dinesh Gunasekara') THEN
        INSERT INTO "Guides" ("Id", "Name", "Languages", "Specializations", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (gde_3, 'Dinesh Gunasekara', ARRAY['English', 'Sinhala', 'Japanese'], ARRAY['Wild Safari', 'Botanical Gardens'], '+94762345678', NOW(), NOW());
    ELSE
        SELECT "Id" INTO gde_3 FROM "Guides" WHERE "Name" = 'Dinesh Gunasekara' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Guides" WHERE "Name" = 'Kavinda Jayasuriya') THEN
        INSERT INTO "Guides" ("Id", "Name", "Languages", "Specializations", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (gde_4, 'Kavinda Jayasuriya', ARRAY['English', 'Sinhala', 'Italian'], ARRAY['Mountain Trekking', 'Tea Trails'], '+94713456789', NOW(), NOW());
    ELSE
        SELECT "Id" INTO gde_4 FROM "Guides" WHERE "Name" = 'Kavinda Jayasuriya' LIMIT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Guides" WHERE "Name" = 'Dilhani Alwis') THEN
        INSERT INTO "Guides" ("Id", "Name", "Languages", "Specializations", "ContactInfo", "CreatedAt", "UpdatedAt")
        VALUES (gde_5, 'Dilhani Alwis', ARRAY['English', 'Sinhala', 'Mandarin'], ARRAY['Coastal Tours', 'Marine Conservation'], '+94784567890', NOW(), NOW());
    ELSE
        SELECT "Id" INTO gde_5 FROM "Guides" WHERE "Name" = 'Dilhani Alwis' LIMIT 1;
    END IF;

    ----------------------------------------------------------------------------
    -- 6. BOOKINGS (Ensure at least 5)
    ----------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM "Bookings" WHERE "Id" = bkg_1) THEN
        INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
        VALUES (bkg_1, u_traveler1_id, pkg_cultural_id, tier_cultural_1, 4, '2026-10-05', '2026-10-09', 500.00, 'Vegetarian meals preferred, early morning departure.', 'Confirmed', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Bookings" WHERE "Id" = bkg_2) THEN
        INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
        VALUES (bkg_2, u_traveler2_id, pkg_hill_id, tier_hill_1, 6, '2026-10-12', '2026-10-17', 600.00, 'Scenic train carriage ride from Nanu Oya to Ella.', 'Confirmed', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Bookings" WHERE "Id" = bkg_3) THEN
        INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
        VALUES (bkg_3, u_traveler3_id, pkg_coastal_id, tier_coastal_1, 2, '2026-10-20', '2026-10-23', 400.00, 'Honeymoon arrangement with sunset boat excursion.', 'Confirmed', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Bookings" WHERE "Id" = bkg_4) THEN
        INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
        VALUES (bkg_4, u_traveler4_id, pkg_wildlife_id, tier_wildlife_1, 8, '2026-11-01', '2026-11-04', 550.00, 'Professional photography assistance in Yala Block 1.', 'Requested', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Bookings" WHERE "Id" = bkg_5) THEN
        INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
        VALUES (bkg_5, u_traveler5_id, pkg_northern_id, tier_northern_1, 14, '2026-11-10', '2026-11-16', 650.00, 'Large educational university delegation.', 'PendingApproval', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "Bookings" WHERE "Id" = bkg_6) THEN
        INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
        VALUES (bkg_6, u_traveler1_id, pkg_hill_id, tier_hill_2, 3, '2026-11-20', '2026-11-25', 450.00, 'Hiking gear rental required.', 'Completed', NOW(), NOW());
    END IF;

    ----------------------------------------------------------------------------
    -- 7. VEHICLE ASSIGNMENTS (Ensure at least 5)
    ----------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM "VehicleAssignments" WHERE "BookingId" = bkg_1) THEN
        INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
        VALUES (gen_random_uuid(), veh_1, bkg_1, drv_1, '2026-10-05', '2026-10-09', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "VehicleAssignments" WHERE "BookingId" = bkg_2) THEN
        INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
        VALUES (gen_random_uuid(), veh_2, bkg_2, drv_2, '2026-10-12', '2026-10-17', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "VehicleAssignments" WHERE "BookingId" = bkg_3) THEN
        INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
        VALUES (gen_random_uuid(), veh_3, bkg_3, drv_3, '2026-10-20', '2026-10-23', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "VehicleAssignments" WHERE "BookingId" = bkg_5) THEN
        INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
        VALUES (gen_random_uuid(), veh_4, bkg_5, drv_4, '2026-11-10', '2026-11-16', NOW(), NOW());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "VehicleAssignments" WHERE "BookingId" = bkg_6) THEN
        INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
        VALUES (gen_random_uuid(), veh_1, bkg_6, drv_5, '2026-11-20', '2026-11-25', NOW(), NOW());
    END IF;

    ----------------------------------------------------------------------------
    -- 8. GUIDE AVAILABILITY (Ensure at least 5)
    ----------------------------------------------------------------------------
    DELETE FROM "GuideAvailabilities";
    INSERT INTO "GuideAvailabilities" ("Id", "GuideId", "Date", "IsAvailable", "AssignedBookingId", "CreatedAt", "UpdatedAt")
    VALUES
    (gen_random_uuid(), gde_1, '2026-10-05', false, bkg_1, NOW(), NOW()),
    (gen_random_uuid(), gde_1, '2026-10-06', false, bkg_1, NOW(), NOW()),
    (gen_random_uuid(), gde_2, '2026-10-12', false, bkg_2, NOW(), NOW()),
    (gen_random_uuid(), gde_3, '2026-10-20', false, bkg_3, NOW(), NOW()),
    (gen_random_uuid(), gde_4, '2026-11-10', false, bkg_5, NOW(), NOW()),
    (gen_random_uuid(), gde_5, '2026-11-20', true, null, NOW(), NOW());

    ----------------------------------------------------------------------------
    -- 9. ITINERARY STEPS (Ensure at least 5)
    ----------------------------------------------------------------------------
    DELETE FROM "ItinerarySteps";
    INSERT INTO "ItinerarySteps" ("Id", "BookingId", "DayNumber", "Activity", "Location", "StartTime", "CreatedAt", "UpdatedAt")
    VALUES
    (gen_random_uuid(), bkg_1, 1, 'Arrival and Transfer to Sigiriya Fortress view hotel', 'Sigiriya', '08:00:00', NOW(), NOW()),
    (gen_random_uuid(), bkg_1, 2, 'Morning Sigiriya Rock climb followed by Dambulla Cave Temple tour', 'Dambulla', '06:30:00', NOW(), NOW()),
    (gen_random_uuid(), bkg_2, 1, 'Kandy to Nuwara Eliya scenic tea estate drive and tasting', 'Nuwara Eliya', '09:00:00', NOW(), NOW()),
    (gen_random_uuid(), bkg_3, 1, 'Whale watching expedition in Mirissa waters', 'Mirissa', '06:00:00', NOW(), NOW()),
    (gen_random_uuid(), bkg_4, 1, 'Afternoon Leopard & Elephant Jeep Safari in Block 1', 'Yala National Park', '14:30:00', NOW(), NOW()),
    (gen_random_uuid(), bkg_5, 1, 'Visit to historical Jaffna Fort and Jaffna Public Library', 'Jaffna', '10:00:00', NOW(), NOW());

    ----------------------------------------------------------------------------
    -- 10. PAYMENTS (Ensure at least 5)
    ----------------------------------------------------------------------------
    DELETE FROM "Payments";
    INSERT INTO "Payments" ("Id", "BookingId", "Amount", "Method", "PaidAt", "Status", "CreatedAt", "UpdatedAt")
    VALUES
    (gen_random_uuid(), bkg_1, 2000.00, 'CreditCard', NOW() - INTERVAL '10 days', 'FullyPaid', NOW(), NOW()),
    (gen_random_uuid(), bkg_2, 3600.00, 'BankTransfer', NOW() - INTERVAL '7 days', 'FullyPaid', NOW(), NOW()),
    (gen_random_uuid(), bkg_3, 800.00, 'CreditCard', NOW() - INTERVAL '3 days', 'FullyPaid', NOW(), NOW()),
    (gen_random_uuid(), bkg_4, 1100.00, 'CreditCard', NOW() - INTERVAL '1 day', 'DepositPaid', NOW(), NOW()),
    (gen_random_uuid(), bkg_5, 2500.00, 'WireTransfer', NOW(), 'DepositPaid', NOW(), NOW()),
    (gen_random_uuid(), bkg_6, 1350.00, 'CreditCard', NOW() - INTERVAL '30 days', 'FullyPaid', NOW(), NOW());

    ----------------------------------------------------------------------------
    -- 11. REVIEWS (Ensure at least 5)
    ----------------------------------------------------------------------------
    DELETE FROM "Reviews";
    INSERT INTO "Reviews" ("Id", "BookingId", "Rating", "Comment", "SubmittedAt", "CreatedAt", "UpdatedAt")
    VALUES
    (gen_random_uuid(), bkg_1, 5, 'Exceptional planning and spotless transportation. The van was very comfortable!', NOW() - INTERVAL '5 days', NOW(), NOW()),
    (gen_random_uuid(), bkg_2, 5, 'Janith was a world-class guide and driver Pradeep took care of us through the mountain bends.', NOW() - INTERVAL '4 days', NOW(), NOW()),
    (gen_random_uuid(), bkg_3, 5, 'Unforgettable honeymoon coastal getaway! Loved every bit of Mirissa.', NOW() - INTERVAL '2 days', NOW(), NOW()),
    (gen_random_uuid(), bkg_6, 4, 'Very good hiking trip in the hill country. Punctual transport and polite driver.', NOW() - INTERVAL '15 days', NOW(), NOW()),
    (gen_random_uuid(), bkg_5, 5, 'Detailed itinerary planning and prompt responses from the coordinator team.', NOW() - INTERVAL '1 day', NOW(), NOW());

    ----------------------------------------------------------------------------
    -- 12. BOOKING ADD-ONS (Ensure at least 5)
    ----------------------------------------------------------------------------
    DELETE FROM "BookingAddOns";
    INSERT INTO "BookingAddOns" ("Id", "BookingId", "Description", "Cost", "CreatedAt", "UpdatedAt")
    VALUES
    (gen_random_uuid(), bkg_1, 'Airport VIP Lounge Meet & Greet', 120.00, NOW(), NOW()),
    (gen_random_uuid(), bkg_2, 'First-Class Scenic Observation Train Tickets', 80.00, NOW(), NOW()),
    (gen_random_uuid(), bkg_3, 'Romantic Candlelight Beach Dinner', 150.00, NOW(), NOW()),
    (gen_random_uuid(), bkg_4, 'Specialized Telephoto Lens Rental', 95.00, NOW(), NOW()),
    (gen_random_uuid(), bkg_5, 'Traditional Tamil Cultural Dance Evening Pass', 200.00, NOW(), NOW());

    ----------------------------------------------------------------------------
    -- 13. AGENT WORKFLOW RUNS & STEP LOGS (Ensure at least 5)
    ----------------------------------------------------------------------------
    DELETE FROM "AgentStepLogs";
    DELETE FROM "AgentWorkflowRuns";

    INSERT INTO "AgentWorkflowRuns" ("Id", "BookingId", "Objective", "PlanJson", "Status", "StartedAt", "CompletedAt", "CreatedAt", "UpdatedAt")
    VALUES
    (wf_1, bkg_1, 'Automated Tour Feasibility & Transport Allocation', '{"status":"Approved","vehicleType":"Van","driverAssigned":true}'::jsonb, 'Completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 50 minutes', NOW(), NOW()),
    (wf_2, bkg_2, 'Hill Country Weather & Train Schedule Verification', '{"trainSeatStatus":"Confirmed","scenicRoute":"NanuOyaToElla"}'::jsonb, 'Completed', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 45 minutes', NOW(), NOW()),
    (wf_3, bkg_3, 'Coastal Resort Confirmation & Guide Matching', '{"guideAssigned":"Dilhani Alwis","hotelConfirmed":true}'::jsonb, 'Completed', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 50 minutes', NOW(), NOW()),
    (wf_4, bkg_4, 'Wildlife Permit & Safari Jeep Reservation Check', '{"parkPermitsIssued":true,"jeepCapacity":8}'::jsonb, 'InProgress', NOW() - INTERVAL '30 minutes', null, NOW(), NOW()),
    (wf_5, bkg_5, 'Northern Expedition Multi-Coach Logistics Optimization', '{"coachRequired":true,"hotelRoomBlocks":8}'::jsonb, 'InProgress', NOW() - INTERVAL '10 minutes', null, NOW(), NOW());

    INSERT INTO "AgentStepLogs" ("Id", "WorkflowRunId", "AgentName", "InputJson", "OutputJson", "ToolCallsJson", "ValidationResult", "DurationMs", "CreatedAt", "UpdatedAt")
    VALUES
    (gen_random_uuid(), wf_1, 'CoordinatorAgent', ('{"bookingId":"' || bkg_1 || '"}')::jsonb, '{"step":"CheckFleet","available":true}'::jsonb, '["check_vehicle_availability"]'::jsonb, 'Valid', 240, NOW(), NOW()),
    (gen_random_uuid(), wf_1, 'FleetAgent', '{"vehicleType":"Van","capacity":7}'::jsonb, ('{"vehicleId":"' || veh_1 || '","status":"Reserved"}')::jsonb, '["reserve_vehicle"]'::jsonb, 'Valid', 310, NOW(), NOW()),
    (gen_random_uuid(), wf_2, 'ItineraryAgent', '{"origin":"Kandy","destination":"Ella"}'::jsonb, '{"trainOption":"1005 Podi Menike"}'::jsonb, '["query_train_timetable"]'::jsonb, 'Valid', 180, NOW(), NOW()),
    (gen_random_uuid(), wf_3, 'GuideAgent', '{"specialization":"Coastal Tours"}'::jsonb, ('{"matchedGuideId":"' || gde_5 || '"}')::jsonb, '["match_guide"]'::jsonb, 'Valid', 290, NOW(), NOW()),
    (gen_random_uuid(), wf_4, 'SafeguardAgent', ('{"bookingId":"' || bkg_4 || '"}')::jsonb, '{"safetyClearance":true}'::jsonb, '["verify_wildlife_safety_conditions"]'::jsonb, 'Valid', 150, NOW(), NOW());

    ----------------------------------------------------------------------------
    -- 14. AUDIT LOGS (Ensure at least 5)
    ----------------------------------------------------------------------------
    DELETE FROM "AuditLogs";
    INSERT INTO "AuditLogs" ("Id", "EntityType", "EntityId", "Action", "PerformedBy", "Timestamp", "Details", "CreatedAt", "UpdatedAt")
    VALUES
    (gen_random_uuid(), 'Vehicle', veh_1, 'Create', u_fleet_id, NOW() - INTERVAL '2 days', '{"make":"Toyota","model":"HiAce VIP","capacity":7}'::jsonb, NOW(), NOW()),
    (gen_random_uuid(), 'Driver', drv_1, 'Register', u_fleet_id, NOW() - INTERVAL '2 days', '{"name":"Sunil Jayawardena","license":"B-1029384"}'::jsonb, NOW(), NOW()),
    (gen_random_uuid(), 'VehicleAssignment', bkg_1, 'Assign', u_fleet_id, NOW() - INTERVAL '1 day', ('{"bookingId":"' || bkg_1 || '","vehicleId":"' || veh_1 || '"}')::jsonb, NOW(), NOW()),
    (gen_random_uuid(), 'Booking', bkg_2, 'Confirm', u_ops_id, NOW() - INTERVAL '12 hours', ('{"bookingId":"' || bkg_2 || '","status":"Confirmed"}')::jsonb, NOW(), NOW()),
    (gen_random_uuid(), 'Payment', bkg_1, 'Receive', u_admin_id, NOW() - INTERVAL '6 hours', '{"amount":2000.00,"method":"CreditCard"}'::jsonb, NOW(), NOW());

END $$;
