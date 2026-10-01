-- Assign 5 diverse dummy bookings with different statuses to driver pk-3c9f371f-ac01-4f63-8f4f-723d751e5f80
DO $$
DECLARE
    target_driver_id UUID := '3c9f371f-ac01-4f63-8f4f-723d751e5f80';
    veh_van_id UUID;
    veh_coach_id UUID;
    
    pkg_cult_id UUID;
    pkg_hill_id UUID;
    pkg_coast_id UUID;
    pkg_wild_id UUID;
    pkg_north_id UUID;

    tier_cult_id UUID;
    tier_hill_id UUID;
    tier_coast_id UUID;
    tier_wild_id UUID;
    tier_north_id UUID;

    traveler1_id UUID := '22222222-2222-2222-2222-222222222221';
    traveler2_id UUID := '22222222-2222-2222-2222-222222222222';
    traveler3_id UUID := '22222222-2222-2222-2222-222222222223';
    traveler4_id UUID := '22222222-2222-2222-2222-222222222224';
    traveler5_id UUID := '22222222-2222-2222-2222-222222222225';

    drv_bkg_1 UUID := 'a1111111-1111-1111-1111-111111111111';
    drv_bkg_2 UUID := 'a2222222-2222-2222-2222-222222222222';
    drv_bkg_3 UUID := 'a3333333-3333-3333-3333-333333333333';
    drv_bkg_4 UUID := 'a4444444-4444-4444-4444-444444444444';
    drv_bkg_5 UUID := 'a5555555-5555-5555-5555-555555555555';
BEGIN
    -- Select vehicles
    SELECT "Id" INTO veh_van_id FROM "Vehicles" WHERE "Type" = 'Van' LIMIT 1;
    SELECT "Id" INTO veh_coach_id FROM "Vehicles" WHERE "Type" = 'Coach' LIMIT 1;
    IF veh_coach_id IS NULL THEN
        veh_coach_id := veh_van_id;
    END IF;

    -- Select packages and tiers
    SELECT "Id" INTO pkg_cult_id FROM "TourPackages" WHERE "Name" LIKE '%Cultural%' LIMIT 1;
    SELECT "Id" INTO tier_cult_id FROM "PackageTiers" WHERE "TourPackageId" = pkg_cult_id LIMIT 1;

    SELECT "Id" INTO pkg_hill_id FROM "TourPackages" WHERE "Name" LIKE '%Hill%' LIMIT 1;
    SELECT "Id" INTO tier_hill_id FROM "PackageTiers" WHERE "TourPackageId" = pkg_hill_id LIMIT 1;

    SELECT "Id" INTO pkg_coast_id FROM "TourPackages" WHERE "Name" LIKE '%Coastal%' LIMIT 1;
    SELECT "Id" INTO tier_coast_id FROM "PackageTiers" WHERE "TourPackageId" = pkg_coast_id LIMIT 1;

    SELECT "Id" INTO pkg_wild_id FROM "TourPackages" WHERE "Name" LIKE '%Wildlife%' LIMIT 1;
    SELECT "Id" INTO tier_wild_id FROM "PackageTiers" WHERE "TourPackageId" = pkg_wild_id LIMIT 1;

    SELECT "Id" INTO pkg_north_id FROM "TourPackages" WHERE "Name" LIKE '%Northern%' LIMIT 1;
    SELECT "Id" INTO tier_north_id FROM "PackageTiers" WHERE "TourPackageId" = pkg_north_id LIMIT 1;

    -- Clean up previous test assignments/bookings if re-running
    DELETE FROM "VehicleAssignments" WHERE "BookingId" IN (drv_bkg_1, drv_bkg_2, drv_bkg_3, drv_bkg_4, drv_bkg_5);
    DELETE FROM "ItinerarySteps" WHERE "BookingId" IN (drv_bkg_1, drv_bkg_2, drv_bkg_3, drv_bkg_4, drv_bkg_5);
    DELETE FROM "Bookings" WHERE "Id" IN (drv_bkg_1, drv_bkg_2, drv_bkg_3, drv_bkg_4, drv_bkg_5);

    -- 1. Active / Confirmed Tour (Immediate Upcoming)
    INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
    VALUES (drv_bkg_1, traveler1_id, pkg_cult_id, tier_cult_id, 4, '2026-10-05', '2026-10-10', 500.00, 'Need child booster seat and early airport pickup.', 'Confirmed', NOW(), NOW());

    INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
    VALUES (gen_random_uuid(), veh_van_id, drv_bkg_1, target_driver_id, '2026-10-05', '2026-10-10', NOW(), NOW());

    INSERT INTO "ItinerarySteps" ("Id", "BookingId", "DayNumber", "Activity", "Location", "StartTime", "CreatedAt", "UpdatedAt")
    VALUES 
    (gen_random_uuid(), drv_bkg_1, 1, 'Airport pickup & Transfer to Sigiriya Hotel', 'Bandaranaike Intl Airport', '07:30:00', NOW(), NOW()),
    (gen_random_uuid(), drv_bkg_1, 2, 'Sigiriya Lion Rock Fortress Morning Ascent', 'Sigiriya', '06:00:00', NOW(), NOW()),
    (gen_random_uuid(), drv_bkg_1, 3, 'Dambulla Golden Rock Cave Temple exploration', 'Dambulla', '09:00:00', NOW(), NOW());

    -- 2. Confirmed Future Tour (Next Month)
    INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
    VALUES (drv_bkg_2, traveler2_id, pkg_hill_id, tier_hill_id, 6, '2026-11-01', '2026-11-06', 650.00, 'Luggage trailer space required for hiking gear.', 'Confirmed', NOW(), NOW());

    INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
    VALUES (gen_random_uuid(), veh_van_id, drv_bkg_2, target_driver_id, '2026-11-01', '2026-11-06', NOW(), NOW());

    INSERT INTO "ItinerarySteps" ("Id", "BookingId", "DayNumber", "Activity", "Location", "StartTime", "CreatedAt", "UpdatedAt")
    VALUES 
    (gen_random_uuid(), drv_bkg_2, 1, 'Kandy Temple of the Tooth Relic visit', 'Kandy', '08:30:00', NOW(), NOW()),
    (gen_random_uuid(), drv_bkg_2, 2, 'Tea plantation and factory tasting tour', 'Nuwara Eliya', '10:00:00', NOW(), NOW());

    -- 3. Completed Past Tour
    INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
    VALUES (drv_bkg_3, traveler3_id, pkg_coast_id, tier_coast_id, 2, '2026-08-10', '2026-08-14', 420.00, 'Honeymoon couple, ocean-side route preferred.', 'Completed', NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days');

    INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
    VALUES (gen_random_uuid(), veh_van_id, drv_bkg_3, target_driver_id, '2026-08-10', '2026-08-14', NOW() - INTERVAL '40 days', NOW() - INTERVAL '35 days');

    INSERT INTO "ItinerarySteps" ("Id", "BookingId", "DayNumber", "Activity", "Location", "StartTime", "CreatedAt", "UpdatedAt")
    VALUES 
    (gen_random_uuid(), drv_bkg_3, 1, 'Bentota river safari & water sports', 'Bentota', '09:00:00', NOW(), NOW()),
    (gen_random_uuid(), drv_bkg_3, 2, 'Galle Dutch Fort heritage sunset walk', 'Galle', '16:00:00', NOW(), NOW());

    -- 4. Cancelled Tour (For filter & warning testing)
    INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
    VALUES (drv_bkg_4, traveler4_id, pkg_wild_id, tier_wild_id, 3, '2026-10-18', '2026-10-22', 580.00, 'Customer flight cancelled due to typhoon.', 'Cancelled', NOW(), NOW());

    INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
    VALUES (gen_random_uuid(), veh_van_id, drv_bkg_4, target_driver_id, '2026-10-18', '2026-10-22', NOW(), NOW());

    INSERT INTO "ItinerarySteps" ("Id", "BookingId", "DayNumber", "Activity", "Location", "StartTime", "CreatedAt", "UpdatedAt")
    VALUES 
    (gen_random_uuid(), drv_bkg_4, 1, 'Yala National Park Afternoon Safari Drive', 'Yala', '14:00:00', NOW(), NOW());

    -- 5. Pending Approval / Delegation Tour (Large Group)
    INSERT INTO "Bookings" ("Id", "TravelerId", "TourPackageId", "PackageTierId", "GroupSize", "StartDate", "EndDate", "BudgetPerPerson", "SpecialRequests", "Status", "CreatedAt", "UpdatedAt")
    VALUES (drv_bkg_5, traveler5_id, pkg_north_id, tier_north_id, 18, '2026-11-20', '2026-11-26', 700.00, 'University archaeology faculty team.', 'PendingApproval', NOW(), NOW());

    INSERT INTO "VehicleAssignments" ("Id", "VehicleId", "BookingId", "DriverId", "StartDate", "EndDate", "CreatedAt", "UpdatedAt")
    VALUES (gen_random_uuid(), veh_coach_id, drv_bkg_5, target_driver_id, '2026-11-20', '2026-11-26', NOW(), NOW());

    INSERT INTO "ItinerarySteps" ("Id", "BookingId", "DayNumber", "Activity", "Location", "StartTime", "CreatedAt", "UpdatedAt")
    VALUES 
    (gen_random_uuid(), drv_bkg_5, 1, 'Jaffna Fort and Public Library guided tour', 'Jaffna', '08:30:00', NOW(), NOW()),
    (gen_random_uuid(), drv_bkg_5, 2, 'Nagadeepa Purana Viharaya boat crossing', 'Nagadeepa', '07:00:00', NOW(), NOW());

END $$;
